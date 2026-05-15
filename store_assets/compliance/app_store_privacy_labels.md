# App Store Privacy Nutrition Label — HealthBridge Vault

_Paste these answers into App Store Connect → App Privacy → Edit._

## Privacy Manifest (`PrivacyInfo.xcprivacy`) summary

We don't use any tracking domains. We do not use SKAdNetwork. We collect a small set of
data that is **linked to the user** but is **not used for tracking**.

## Data Types Collected

### 1. Contact Info

| Data Type | Collected? | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|---|
| Email Address | **Yes** | **Yes** | No | App Functionality, Account Management |
| Name | **Yes** | **Yes** | No | App Functionality, Personalization |

### 2. Health & Fitness

| Data Type | Collected? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| Health (steps, heart rate, sleep, exercise, SpO2, calories, distance, active minutes) | **Yes** | **Yes** | No | App Functionality, Analytics |
| Fitness | **Yes** | **Yes** | No | App Functionality, Analytics |

### 3. Identifiers

| Data Type | Collected? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| User ID (server-issued) | **Yes** | **Yes** | No | App Functionality |
| Device ID / Push token | **Yes** | **Yes** | No | App Functionality (push notifications) |

### 4. Usage Data

| Data Type | Collected? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| Product Interaction (sync events, opens) | **Yes** | **Yes** | No | App Functionality, Analytics |

### 5. Diagnostics

| Data Type | Collected? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| Crash data | No | n/a | n/a | n/a |
| Performance data | No | n/a | n/a | n/a |

### NOT collected

❌ Financial info (Stripe handles payment, we never see card data) · ❌ Location · ❌ Contacts · ❌ User-generated content · ❌ Search history · ❌ Browsing history · ❌ Audio data · ❌ Photos or videos · ❌ Sensitive info · ❌ Other data types

## Required Reason API declarations (if used in code)

None required — we do not call `UserDefaults`, `FileTimestamp`, `SystemBootTime`, `DiskSpace`, or `ActiveKeyboards` APIs directly.

## App Tracking Transparency

**Not required.** We do not track users across apps/websites owned by other companies and do not use IDFA.

## Encryption (Export Compliance)

- HTTPS-only transport (TLS). Standard system encryption only.
- `ITSAppUsesNonExemptEncryption = false` is set in `Info.plist` (via `app.json` infoPlist key). Skips the export compliance questionnaire on each build.

## Privacy Policy URL

Served at `/privacy` (frontend) and `/api/legal/privacy` (raw markdown for App Store Connect crawler).
