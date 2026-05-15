# App Privacy / Data Safety Answers

Copy-paste these into App Store Connect → App Privacy and Google Play Console → Data Safety.

## Data we collect

| Data type | Collected | Linked to user | Used for | Optional |
|---|---|---|---|---|
| **Email address** | YES | YES | Account, customer support | NO |
| **Name** | YES (optional) | YES | Personalization | YES |
| **Password (hashed)** | YES | YES | Authentication | NO |
| **Health & Fitness data** (steps, heart rate, sleep, SpO₂, ECG, workouts, calories, stand) | YES with consent | YES | App functionality (bridge), analytics aggregated, not used for ads | YES — opt-out per metric |
| **Device identifiers (Expo push token)** | YES | YES | Push notifications | YES — denying notifications skips collection |
| **Subscription / Purchase history (Stripe customer ID)** | YES | YES | Billing | NO if subscribing |
| **Crash data / Diagnostics** | NO | — | — | — |
| **Precise location** | NO | — | — | — |
| **Contacts, Photos, Mic, Camera** | NO | — | — | — |

## How is data protected?
- **In transit**: TLS 1.3 between the app and our FastAPI service.
- **At rest**: AES-256 on encrypted MongoDB volumes (Atlas-managed when in production).
- **Authentication**: JWT access tokens (60 min) + refresh tokens stored in iOS Keychain / Android Keystore via `expo-secure-store`.
- **Biometric gate**: The Privacy Vault (export, raw record viewer) requires FaceID / Touch ID / device biometric before unlocking.

## How can users request deletion?
- In-app: Settings → Data & Privacy → Delete Account (full wipe + Stripe customer purge).
- By email: `privacy@healthbridge.app` (response within 30 days, GDPR-compliant).

## Third parties that receive data
| Third party | What they receive | Why |
|---|---|---|
| **Stripe** | Email, name, Stripe customer ID, payment metadata | Subscription billing |
| **Expo (push notifications)** | Push token only — never health data payloads | Notification delivery |
| **MongoDB Atlas** | Encrypted-at-rest application data | Database hosting |
| **Apple HealthKit / Health Connect / Samsung Health** | The data the user explicitly grants | OS-level health stores; we never re-share it |

## Apple HealthKit specifics (required on App Review)
- We do **not** use HealthKit data for marketing or advertising.
- We do **not** sell HealthKit data.
- We do **not** use HealthKit data for any non-health purpose.
- We do **not** disclose HealthKit data to a third party except as required by law.
- HealthKit data leaves the device only when the user has explicitly authorized cross-ecosystem sync.

## Google Play Health Connect specifics
- We declare every `health.READ_*` and `health.WRITE_*` permission individually in `app.json` Android permissions.
- Each permission is requested in-context via `HealthConnect.requestPermission`.
- Users can revoke any permission at any time in OS settings — the app gracefully falls back.

## Children
- App is not directed at children under 13. Account creation requires confirmation of 13+ on registration.

## Compliance
- **GDPR**: Users in the EU can export or delete their data on request. Data Controller: HealthBridge Labs, EU representative listed at `/privacy`.
- **HIPAA**: Although HealthBridge is **not** a Covered Entity, the app applies HIPAA-grade encryption and access controls.
- **CCPA**: California users can request a copy of their data and opt out of any sale (we never sell data).
