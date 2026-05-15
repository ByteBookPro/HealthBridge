# EAS Build & Deployment Guide

## Prerequisites
- Apple Developer Program ($99/yr) — for App Store + HealthKit entitlements
- Google Play Console one-time $25 — for Health Connect
- EAS CLI (`npm i -g eas-cli`) and `eas login`

## Project configuration (already done)
- `app.json` — slug `healthbridge-vault`, bundle id `com.healthbridge.vault` (set in Apple/Google consoles), permissions for HealthKit / Health Connect / FaceID / Bluetooth / Notifications, scheme `healthbridge`.
- `eas.json` — three profiles: `development`, `preview`, `production`.
- `.env` — `EXPO_PUBLIC_BACKEND_URL` points to your FastAPI service.

## Build commands

```bash
# Development client (loads JS from your laptop)
eas build --profile development --platform ios
eas build --profile development --platform android

# Internal preview (TestFlight / Play Internal Testing)
eas build --profile preview --platform all

# Production
eas build --profile production --platform all
```

## Submission

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Fill in `eas.json > submit > production` with your `appleId`, `ascAppId`, `appleTeamId`, and place your Google Play `service-account.json` next to it.

## Required secrets (set via `eas secret:create`)
| Secret | Where used |
|---|---|
| `STRIPE_API_KEY` (live) | backend `.env` |
| `STRIPE_WEBHOOK_SECRET` | backend `.env` |
| `JWT_SECRET` | backend `.env` |
| `MONGO_URL` (Atlas with auth) | backend `.env` |

## OTA updates
```bash
eas update --branch production --message "tiny fix"
```
The dev/production builds use the `production` channel from `eas.json`.

## Bumping versions
EAS auto-increments `buildNumber` (iOS) / `versionCode` (Android) on production builds via `autoIncrement: true`. Bump `expo.version` in `app.json` manually for marketing version changes.

## Troubleshooting
- **HealthKit signing error** — enable the HealthKit capability on your provisioning profile in App Store Connect → Identifiers.
- **Health Connect not available** — Health Connect requires Android 14+ or the Health Connect APK preinstalled. Install from Play Store: `com.google.android.apps.healthdata`.
- **Push delivery missing** — verify the device token is present in `db.push_tokens` and that the device has notifications allowed in iOS Settings / Android system permissions.
