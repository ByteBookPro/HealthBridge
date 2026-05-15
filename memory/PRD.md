# HealthBridge Vault — PRD

## Vision
A premium, dark-first, glassmorphism mobile app that bridges Apple Health, Samsung Health and Google Fit so users can use Apple Watch with Android phones and Galaxy Watch with iPhones — without losing any health data.

## Tech Stack
- Frontend: Expo SDK 54 (React Native + expo-router), expo-blur, expo-linear-gradient, react-native-reanimated, react-native-svg, expo-secure-store, expo-local-authentication, @expo-google-fonts/{outfit,manrope}
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT
- Auth: JWT (access 60min / refresh 14 days), tokens stored via expo-secure-store (`@/src/utils/storage`)
- Biometric: expo-local-authentication (gates the Privacy Vault); web falls back to simulated unlock

## Implemented Features (MVP)
1. **Onboarding** — premium hero, value props, primary/secondary CTAs
2. **Auth** — register/login/refresh/me with JWT; demo credentials auto-seed full account
3. **Dashboard** — greeting header, bridge status (Apple ⇄ Vault ⇄ Samsung), animated Activity Rings (Move/Exercise/Stand), 5+ metric cards (steps, heart rate, sleep, SpO₂, ECG, calories) with sparklines, platform badges and delta chips
4. **Watches** — Apple Watch + Galaxy Watch cards, battery, last-sync, one-tap toggle (connect/disconnect via `/api/watches/{id}/toggle`)
5. **Sync** — per-metric bidirectional toggles, conflict resolution policy selector (latest_wins / apple_wins / samsung_wins / manual), live audit log of recent sync events with direction arrows
6. **Vault** — biometric gate (FaceID/Touch/passcode → simulated on web), encrypted-archive badges, manual export (JSON / CSV / GPX)
7. **Settings** — profile, background-sync toggle, notifications toggle, permissions/audit shortcuts, sign-out

## Backend Endpoints (all `/api`)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `GET /watches`, `POST /watches/{id}/toggle`
- `GET /metrics/summary`, `POST /metrics/sync-now`
- `GET /sync/preferences`, `PUT /sync/preferences/{metric}`
- `GET /sync/policy`, `PUT /sync/policy`
- `GET /sync/events?limit=N`
- `GET /vault/export?fmt=json|csv|gpx`

## What is mocked vs real
- ✅ Real: JWT auth, MongoDB persistence, all CRUD, audit log writes, sync-now jitter.
- 🧪 MOCKED: Native HealthKit / Health Connect / Samsung Health bridges and Apple Watch / Galaxy Watch live BLE data. These require a custom EAS dev build with `react-native-health` / `react-native-health-connect` / Samsung Health SDK — config and permissions are already declared in `app.json`.

## Premium business hook
Privacy Vault export as portable archive + "PRO" badge on profile is the seed for a $4.99/mo subscription (raw health export + multi-watch bridging) — primed for Stripe later.
