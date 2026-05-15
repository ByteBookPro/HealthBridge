# Play Store Data Safety Form — HealthBridge Vault

_Paste these answers into Play Console → App content → Data safety._

## Section 1: Data collection and security

- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS/TLS for every request)
- **Do you provide a way for users to request that their data is deleted?** Yes (Settings → Delete account, plus `/api/auth/delete` endpoint)
- **Have you committed to follow the Google Play Families Policy?** No (app is 13+)
- **Have you independently validated your security practices against a global standard?** No

## Section 2: Data types collected/shared

### Personal info

| Type | Collected | Shared | Optional? | Purposes | Justification |
|---|---|---|---|---|---|
| Name | ✅ Yes | ❌ No | Optional | Account management, Personalization | Displayed in profile and welcome message |
| Email address | ✅ Yes | ❌ No | Required | Account management, Communications | Used for sign-in and account recovery |
| User IDs | ✅ Yes | ❌ No | Required | Account management, App functionality | Server-issued user_id for API auth |

### Health & Fitness

| Type | Collected | Shared | Optional | Purposes | Justification |
|---|---|---|---|---|---|
| Health info (heart rate, SpO2) | ✅ Yes | ❌ No | Required | App functionality, Analytics | Core feature — cross-watch sync |
| Fitness info (steps, exercise, sleep) | ✅ Yes | ❌ No | Required | App functionality, Analytics | Core feature |

### App activity

| Type | Collected | Shared | Optional | Purposes |
|---|---|---|---|---|
| App interactions (sync events) | ✅ Yes | ❌ No | Required | App functionality, Analytics |

### Device / Other identifiers

| Type | Collected | Shared | Optional | Purposes |
|---|---|---|---|---|
| Device or other IDs (Expo push token) | ✅ Yes | ❌ No | Optional | App functionality (push notifications) |

### NOT collected

❌ Financial info · ❌ Location · ❌ Contacts · ❌ Messages · ❌ Photos and videos · ❌ Audio files · ❌ Files and docs · ❌ Calendar · ❌ Web browsing · ❌ Installed apps

## Section 3: Health Connect data types

If Health Connect access is requested at runtime, declare the following read/write permissions with the
following **rationale strings** (Play Console requires per-permission justifications):

| Permission | Read | Write | Rationale |
|---|---|---|---|
| `android.permission.health.READ_STEPS` | ✅ | ✅ | Bridge step counts when migrating watches |
| `android.permission.health.READ_HEART_RATE` | ✅ | ✅ | Bridge heart rate readings across watches |
| `android.permission.health.READ_SLEEP` | ✅ | ✅ | Bridge sleep sessions across watches |
| `android.permission.health.READ_EXERCISE` | ✅ | ✅ | Bridge workouts across watches |
| `android.permission.health.READ_OXYGEN_SATURATION` | ✅ | ❌ | Display oxygen saturation in dashboard |
| `android.permission.health.READ_TOTAL_CALORIES_BURNED` | ✅ | ❌ | Display calorie totals |

**Required justification for Health Connect access** (must match the wording on Play Console):
> HealthBridge Vault uses Health Connect to bridge user health metrics across multiple watches and brands so that switching devices does not lose history. All data stays in the user's account; we do not sell or share it.
