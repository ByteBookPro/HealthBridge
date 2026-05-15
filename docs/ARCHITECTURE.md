# HealthBridge Vault — Architecture

```
┌────────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│  iOS · Apple Watch │──BLE──│  iPhone (Expo app)   │       │  Apple Health   │
│  HealthKit         │◀─────▶│  react-native-health │◀─────▶│  HK store       │
└────────────────────┘       │  expo-secure-store   │       └─────────────────┘
                             │  expo-notifications  │
┌────────────────────┐       │  expo-local-auth     │       ┌─────────────────┐
│ Android · Galaxy   │──BLE──│  Same JS code (95%+) │       │ Health Connect  │
│ Watch / Samsung    │◀─────▶│  react-native-health-│◀─────▶│ Samsung Health  │
│ Health             │       │  connect             │       │ Google Fit      │
└────────────────────┘       └──────────┬───────────┘       └─────────────────┘
                                        │ TLS 1.3
                                        ▼
                          ┌─────────────────────────────┐
                          │   FastAPI Bridge Service    │
                          │   (k8s, /api prefix)        │
                          │  ┌──────────────────────┐   │
                          │  │ JWT auth · bcrypt    │   │
                          │  │ Cross-ecosystem      │   │
                          │  │ normalisation        │   │
                          │  │ Conflict resolution  │   │
                          │  │ Stripe webhook       │   │
                          │  │ Expo push dispatcher │   │
                          │  │ Admin RBAC           │   │
                          │  └──────────┬───────────┘   │
                          └─────────────┼───────────────┘
                                        │
                          ┌─────────────▼───────────────┐
                          │   MongoDB (encrypted vol)   │
                          │  users · watches            │
                          │  metric_summaries · events  │
                          │  push_tokens · stripe_events│
                          └─────────────────────────────┘

                         ┌─────────────┐    ┌─────────────────────┐
                         │  Stripe     │    │  Expo Push Service  │
                         │  Billing    │    │  exp.host           │
                         └─────────────┘    └──────────┬──────────┘
                                                       ▼
                                                  APNs / FCM
```

## Modules

### Client (`/app/frontend`)
- **Routing**: expo-router file-based.  `/(auth)/*` for unauthed, `/(tabs)/*` for users, `/admin/*` for admins (RBAC enforced in `_layout.tsx`).
- **State**: `AuthContext` (JWT in expo-secure-store) + per-screen React state.
- **Native bridges** (loaded conditionally):
  - `react-native-health` (iOS HealthKit) via `/src/services/healthBridge.ts`
  - `react-native-health-connect` (Android Health Connect)
  - `expo-local-authentication` (biometric vault gate)
  - `expo-notifications` (Expo Push)
- **UI** is 100% React Native (`View`, `Text`, `Pressable`, `Switch`, `TextInput`) – no HTML elements.

### Server (`/app/backend/server.py`)
- FastAPI · Motor (async MongoDB)
- All routes mounted under `/api/*` to match the Kubernetes ingress.
- Auth: bcrypt + JWT (HS256, 60-min access, 14-day refresh).
- Subscriptions: Stripe Customer + Checkout + Customer Portal + Webhook with idempotency on `stripe_events.id`.
- Push: `send_push(user_id, title, body, data)` → POSTs to `https://exp.host/--/api/v2/push/send`.
- Admin: gated by `is_admin=true`; idempotent admin seed on startup.

### Cross-ecosystem normalization
| App Health field | Apple HealthKit | Health Connect | Samsung Health |
|---|---|---|---|
| `steps` | HKQuantityTypeIdentifierStepCount | Steps | StepCount |
| `heart_rate` | HKQuantityTypeIdentifierHeartRate | HeartRate | HeartRate |
| `sleep` | HKCategoryTypeIdentifierSleepAnalysis | SleepSession | Sleep |
| `spo2` | HKQuantityTypeIdentifierOxygenSaturation | OxygenSaturation | OxygenSaturation |
| `ecg` | HKElectrocardiogramType | (manual) | (manual) |
| `calories` | HKQuantityTypeIdentifierActiveEnergyBurned | TotalCaloriesBurned | TotalCalories |
| `workouts` | HKWorkoutType | ExerciseSession | Exercise |

### Conflict resolution
Backed by `db.conflict_policy.policy ∈ {latest_wins, apple_wins, samsung_wins, manual}` per-user; resolution happens on `/api/metrics/ingest`.

### Security
- TLS 1.3 in transit, AES-256 at rest (MongoDB encrypted volume).
- JWT secrets in `.env`, never in code.
- Biometric gate on Privacy Vault before any export.
- Webhook signature verification (`stripe.Webhook.construct_event`).
- Idempotent webhook handling via `stripe_events` collection.
- Password reset tokens expire after 1h (TTL index) and are single-use.
