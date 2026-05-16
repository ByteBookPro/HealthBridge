# HealthBridge Vault - Product Requirements Document (PRD)

## Version 5.0 | Last Updated: May 2026

---

## 1. Product Vision

**HealthBridge Vault** is a premium cross-ecosystem health data bridge that unifies health metrics from Apple Watch, Galaxy Watch, Fitbit, Garmin, and other wearables into a single, beautifully designed mobile application. It breaks the Apple/Android ecosystem barrier by syncing health data bidirectionally.

### Core Value Proposition
- **Cross-Ecosystem Sync**: Apple Health ↔ Health Connect (Android) bidirectional sync
- **Universal Watch Support**: Connect any smartwatch regardless of phone platform
- **AI-Powered Insights**: GPT-powered weekly health reports and recommendations
- **Privacy-First**: End-to-end encrypted health data vault with biometric authentication
- **Scientific Metrics**: Hospital-grade health calculations and analysis
- **One Dashboard**: 33+ metrics across 5 categories in one unified view

---

## 2. Target Users

### Primary Personas
1. **Cross-Platform Families**: iPhone user with Samsung watch, or Android user wanting Apple Health data
2. **Health Enthusiasts**: Users who want detailed scientific analysis of their health metrics
3. **Multi-Device Users**: People with multiple wearables (Fitbit for sleep, Apple Watch for workouts)
4. **Privacy-Conscious Users**: Those wanting encrypted, self-controlled health data

---

## 3. Feature Specifications

### 3.1 Authentication System
| Feature | Status | Description |
|---------|--------|-------------|
| Email/Password Auth | ✅ Done | JWT-based authentication |
| Password Reset | ✅ Done | Email-based reset flow |
| Token Refresh | ✅ Done | Auto-refresh before expiry |
| Role-Based Access | ✅ Done | FREE, PRO, ADMIN roles |
| 30-Day PRO Trial | ✅ Done | New users get PRO features free |
| Biometric Lock | ✅ Done | Face ID / Touch ID / Fingerprint support |

### 3.2 Health Metrics Dashboard (33 Metrics)
| Category | Metrics | Status |
|----------|---------|--------|
| **Activity** (6) | Steps, Distance, Active Minutes, Floors Climbed, Calories Burned, Stand Hours | ✅ Done |
| **Exercise** (5) | Workout Time, Workout Count, VO2 Max, Training Load, Recovery Time | ✅ Done |
| **Nutrition** (6) | Calorie Intake, Protein, Carbs, Fat, Water Intake, Fiber | ✅ Done |
| **Body** (6) | Weight, BMI, Body Fat, Muscle Mass, Sleep Duration, Sleep Quality | ✅ Done |
| **Vitals** (10) | Heart Rate, Resting HR, HRV, Blood Pressure (Sys/Dia), SpO2, Respiratory Rate, Body Temp, ECG, Stress Level | ✅ Done |

### 3.3 Dashboard Features
| Feature | Status | Description |
|---------|--------|-------------|
| Activity Rings | ✅ Done | Calories, Exercise, Steps progress rings |
| Collapsible Categories | ✅ Done | Organize 33 metrics into 5 expandable categories |
| Sparkline Trends | ✅ Done | Mini charts on each metric card |
| Source Badges | ✅ Done | Shows Apple/Samsung data origins on each metric |
| Delta Indicators | ✅ Done | +/-% change from previous period |
| Metric Customization | ✅ Done | Toggle individual metrics on/off |
| Quick Actions | ✅ Done | Water tracking, Badges, SOS, Settings |

### 3.4 Metric Detail Screens
| Feature | Status | Description |
|---------|--------|-------------|
| Historical Charts | ✅ Done | Day/Week/Month/Year views with SVG charts |
| Statistics | ✅ Done | Avg, Min, Max, Total calculations |
| Week Comparison | ✅ Done | This Week vs Last Week visual comparison |
| Health Tips | ✅ Done | Personalized tips per metric type |
| Source Badges | ✅ Done | Shows Apple/Samsung data origins |
| Heart Rate Zones | ✅ Done | Fat Burn/Cardio/Peak zone breakdown |
| Sleep Stages | ✅ Done | Visual sleep stage composition |

### 3.5 App Connectors (NEW)
| App | Platform | Metrics Enabled | Status |
|-----|----------|-----------------|--------|
| Apple Health | iOS | steps, heart_rate, sleep, calories, workouts, vo2_max, hrv, spo2, ecg | ✅ Done |
| Google Fit | Android | steps, heart_rate, sleep, calories, distance, active_minutes | ✅ Done |
| Samsung Health | Android | steps, heart_rate, sleep, calories, stress, blood_pressure, spo2 | ✅ Done |
| Fitbit | iOS/Android | steps, heart_rate, sleep, calories, active_minutes, floors, distance | ✅ Done |
| Garmin Connect | iOS/Android | steps, heart_rate, sleep, calories, vo2_max, training_load, recovery_time, stress | ✅ Done |
| MyFitnessPal | iOS/Android | calorie_intake, protein, carbs, fat, fiber, water | ✅ Done |
| Strava | iOS/Android | workouts, distance, calories, heart_rate, vo2_max | ✅ Done |
| Oura Ring | iOS/Android | sleep, sleep_quality, hrv, resting_hr, body_temp, respiratory_rate | ✅ Done |
| Withings | iOS/Android | weight, bmi, body_fat, muscle_mass, blood_pressure | ✅ Done |

### 3.6 Universal Watch Connectivity
| Feature | Status | Description |
|---------|--------|-------------|
| Platform Detection | ✅ Done | Auto-detect iOS/Android/Web |
| Watch Selection | ✅ Done | 8 brands: Apple, Samsung, Google, Fitbit, Garmin, Xiaomi, Huawei, Withings |
| HealthKit Integration | ✅ Done | Native iOS health bridge |
| Health Connect | ✅ Done | Android unified health API |
| Permission Flow | ✅ Done | Step-by-step permission requests |
| Setup Wizard | ✅ Done | Guided setup experience |
| Connected Devices Card | ✅ Done | Shows connected watches with battery % |

### 3.7 PRO Features (Subscription)
| Feature | Status | Description |
|---------|--------|-------------|
| AI Weekly Insights | ✅ Done | GPT-powered health analysis |
| Custom Goals | ✅ Done | Set personal health targets |
| Weekly Reports | ✅ Done | Detailed PDF-style reports |
| Stripe Billing | ✅ Done | $4.99/month subscription |
| Vault Export | ✅ Done | JSON/CSV/GPX export options |

### 3.8 Security Features (NEW)
| Feature | Status | Description |
|---------|--------|-------------|
| Biometric Lock | ✅ Done | Face ID / Touch ID / Fingerprint |
| App Lock Settings | ⏳ Planned | Configure timeout and sensitive actions |
| End-to-End Encryption | ✅ Done | All health data encrypted |

### 3.9 Admin Features
| Feature | Status | Description |
|---------|--------|-------------|
| User Management | ✅ Done | View/manage all users |
| KPI Dashboard | ✅ Done | Total users, PRO users, revenue |
| Subscription Stats | ✅ Done | MRR, churn rate analytics |

---

## 4. Technical Requirements

### 4.1 Stack
- **Frontend**: Expo (React Native) with TypeScript
- **Backend**: FastAPI (Python 3.11+)
- **Database**: MongoDB
- **Auth**: JWT with bcrypt password hashing
- **AI**: Emergent LLM Integration (OpenAI-compatible)
- **Payments**: Stripe (test mode configured)

### 4.2 Key Dependencies (Frontend)
```json
{
  "expo": "~53.0.0",
  "expo-router": "~5.0.0",
  "expo-local-authentication": "~17.0.8",
  "react-native-reanimated": "~3.17.0",
  "react-native-svg": "15.11.2",
  "victory-native": "^41.20.3"
}
```

### 4.3 API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/metrics/summary` | GET | Get 8 basic metrics |
| `/api/metrics/summary/all` | GET | Get all 33 metrics |
| `/api/metrics/categories` | GET | Get metrics organized by category |
| `/api/metrics/{metric}/detail` | GET | Get detailed metric data |
| `/api/insights` | GET | AI health insights (PRO) |
| `/api/goals` | GET/POST | User health goals (PRO) |
| `/api/watches` | GET | Get connected watches |
| `/api/admin/stats` | GET | Admin KPI dashboard |

---

## 5. File Structure

```
/app
├── backend/
│   ├── server.py           # FastAPI application (1600+ lines)
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── app/
│   │   ├── (tabs)/        # Tab screens (index, watches, sync, vault, settings)
│   │   ├── (auth)/        # Auth screens (login, register)
│   │   ├── metric/[id].tsx # Metric detail screen
│   │   ├── onboarding.tsx  # Landing page (redesigned)
│   │   ├── setup.tsx       # Watch setup wizard
│   │   ├── app-connectors.tsx # App connectors screen (NEW)
│   │   ├── customize-metrics.tsx # Metric toggle screen (NEW)
│   │   └── ...
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── api/client.ts  # API client
│   │   ├── context/       # Auth context
│   │   ├── services/      # BiometricAuth, HealthBridge
│   │   └── theme/         # Theme configuration
│   └── .env              # Frontend environment variables
└── memory/
    ├── PRD.md            # This file
    └── test_credentials.md # Test accounts
```

---

## 6. Pending/Future Work

### Phase C: Watch Proximity & Syncing Animation (COMPLETED)
| Feature | Status | Description |
|---------|--------|-------------|
| Watch Proximity Detection | ✅ Done | `POST /watches/{id}/proximity` returns rssi/distance/in_range; UI shows animated radar scan modal before connect |
| Primary Data Source Selection | ✅ Done | `POST /connectors/primary` per metric; picker on customize-metrics screen when ≥2 providers connected |
| Syncing Animation | ✅ Done | `SyncingOverlay` component (pulsing rings + flow particles + rotating arc) shown during sync-now & connector connect |
| Connector-aware metric gating | ✅ Done | `/metrics/availability` map; locked dashboard cards + locked toggle in customize-metrics until a relevant connector is connected |

### Future Enhancements
- Push notifications for health alerts
- Widgets for iOS/Android home screens
- Apple Watch companion app
- Health data sharing with doctors
- Integration with more fitness apps

---

## 7. Test Credentials

| Account Type | Email | Password |
|--------------|-------|----------|
| Demo (PRO Trial) | demo@healthbridge.app | Demo1234! |
| Admin + PRO | admin@healthbridge.app | ySk4rWp4nSn5KsB8WvI4iF |

---

## 8. Changelog

### v5.3 (May 2026 — Admin console expansion + prod hardening)
- ✅ Admin: 3 new tabs — **Connectors** (per-app adoption % with progress bars + device-profile distribution), **Engagement** (DAU/WAU/MAU, signups, churn signals), **System Health** (read-only mongo/llm/stripe/jwt/indexes self-test + Stripe billing-mode card)
- ✅ Admin: user detail drawer — tapping any user opens a slide-up modal with connected apps, devices, recent syncs, goals + a red GDPR delete button (blocked for admins themselves)
- ✅ `DELETE /api/admin/users/{user_id}` — GDPR right-to-erase that wipes 16 collections + password_resets keyed by user_id; refuses to delete self with 400; logs only user_id (no email PII)
- ✅ Phase C indexes (connectors, metric_primary, user_devices) added to the startup hook with unique=True
- ✅ Idempotent `/admin/health` — switched from `create_index` (mutating + conflict-prone) to `list_indexes` verification
- ✅ Frontend health tab: top-level OK badge now aggregates every child check (not just the top-level field)
- ✅ Backend test suite expanded to 79+ cases; all green across 7 testing iterations

### v5.2 (May 2026 — Phase C polish)
- ✅ Bulk "Connect all available" affordance on /app-connectors (`POST /api/connectors/connect-all`) — filters by platform on native, connects every disconnected one on web
- ✅ Per-device primary-source overrides — `device_id` column on `metric_primary`, scoped writes via `POST /api/connectors/primary` body; `GET /api/metrics/availability?device_id=...` returns per-device-overridden primaries
- ✅ Device profile registration — `POST /api/devices/register`, `GET /api/devices`; client uses `useDevice()` hook (SecureStore on native, IndexedDB-backed AsyncStorage on web)
- ✅ Native CoreBluetooth proximity scan wired in — `HealthBridge.scanProximity()` uses `react-native-ble-plx` on real iOS/Android dev builds with iBeacon path-loss RSSI→distance; falls back to simulated `/api/watches/{id}/proximity` on web/Expo Go. UI shows a "NATIVE BLE SCAN" vs "SIMULATED" badge so testers know which path ran.
- ✅ Fixed pre-existing `MetricLiteral` mismatch (was Literal of 8 names; expanded to all 33) — `/api/metrics/summary` now returns 200 instead of 500

### v5.1 (May 2026 — Phase C complete)
- ✅ Watch proximity scan (animated radar) before any Connect Watch action — `POST /api/watches/{id}/proximity`
- ✅ Connectors backend: 9 connectors auto-seeded disconnected per user; connect/disconnect via `/api/connectors/*`
- ✅ Per-metric primary data source picker — `POST /api/connectors/primary` + UI on `/customize-metrics`
- ✅ Metric availability gating — `GET /api/metrics/availability`; dashboard cards & customize-metrics toggles lock until a connected provider exists
- ✅ Animated SyncingOverlay during connect & pull-to-refresh

### v5.0 (May 2026)
- ✅ Redesigned onboarding page with animations
- ✅ 33 comprehensive health metrics (was 8)
- ✅ 5 metric categories (Activity, Exercise, Nutrition, Body, Vitals)
- ✅ App Connectors screen with 9 health apps
- ✅ Metric customization (show/hide metrics)
- ✅ Biometric authentication support
- ✅ Connected Devices card on dashboard
- ✅ New Settings sections (App Connections, Security)

### v4.0 (Previous)
- Initial PRO features (AI Insights, Goals, Reports)
- Stripe subscription integration
- Admin dashboard
- 8 basic health metrics
