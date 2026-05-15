# HealthBridge Vault — PRD (v2)

## Vision
Cross-ecosystem health-data bridge with full-stack mobile app, premium UI, **paid subscription tier**, and a **web admin portal** for CRM, subscriptions, broadcasts and audit.

## Stack
- **Frontend**: Expo SDK 54 (React Native + expo-router), expo-blur, expo-linear-gradient, react-native-reanimated, react-native-svg, expo-secure-store, expo-local-authentication, expo-notifications, expo-web-browser, @expo-google-fonts/{outfit,manrope}.
- **Backend**: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + Stripe + httpx.
- **Native bridge** (drop-in via EAS dev build): react-native-health (iOS HealthKit) and react-native-health-connect (Android).

## Implemented features

### User app (`/(tabs)/*` and `/(auth)/*`)
1. Onboarding · Login · Register · **Forgot password (token-based)** · Auto-login
2. Dashboard — bridge status card, animated Activity Rings, metric cards, sync-now
3. Watches — Apple Watch + Galaxy Watch with connect/disconnect toggle
4. Sync — per-metric bidirectional switches, conflict policy, live audit log
5. Vault — biometric gate (FaceID/Touch/passcode) + JSON/CSV/GPX export
6. Settings — profile, **PRO upgrade card with Stripe checkout**, **Manage subscription via Stripe portal**, **Admin Portal link for admins**, background-sync, notifications, audit, sign-out

### Admin web (`/admin`)
1. Overview — total users / PRO / MRR / syncs 24h / active subs / pushes
2. Users — search, grant PRO, cancel subscription, ADMIN/PRO tags
3. Broadcast — push to all registered devices
4. Audit — last 100 sync events + last 100 notifications globally

### Backend (`/api/*`)
- Auth: register / login / refresh / me / **profile update** / **change password** / **forgot+reset password**
- Watches: list, toggle
- Metrics: summary, sync-now, **ingest** (native bridge → cloud)
- Sync: prefs, policy, events
- Vault: export
- **Push**: register token, test send, broadcast
- **Billing**: checkout (Stripe), customer portal, webhook (idempotent), DB persistence of plan/period/cancel-at-end
- **Admin**: stats, users (search), set plan, cancel sub, broadcast, global audit

## Mocked vs real
- ✅ Real: JWT auth, MongoDB persistence, all CRUD, audit log, sync-now jitter, **Stripe Checkout against test key**, **Expo Push** (works as soon as a real push token registers), **idempotent webhook**, admin RBAC.
- 🧪 Real **but** Expo Go preview can't load the native modules: HealthKit / Health Connect / Samsung Health bridge code (`/app/frontend/src/services/healthBridge.ts`) — verified, configured, and ready for `eas build --profile development`.

## Subscription economics
- HealthBridge PRO: $4.99 / mo (Stripe price_data, USD).
- MRR formula in admin: `active_subscriptions × 4.99`.
- Free tier permanent: dashboard + last-30-days export.

## Files added in v2
- `/app/frontend/app/admin/_layout.tsx`, `/app/frontend/app/admin/index.tsx` (web admin portal)
- `/app/frontend/app/(auth)/forgot.tsx`
- `/app/frontend/src/services/healthBridge.ts`, `pushNotifications.ts`
- `/app/frontend/eas.json`
- `/app/docs/ARCHITECTURE.md`, `NATIVE_BRIDGE.md`, `EAS_BUILD.md`, `PUBLISHING_KIT.md`, `DATA_SAFETY.md`, `PRIVACY_POLICY.md`, `TERMS.md`, `ADMIN_PORTAL.md`

## Test credentials
See `/app/memory/test_credentials.md`. Demo `demo@healthbridge.app / Demo1234!` (FREE) and admin `admin@healthbridge.app / Admin1234!` (PRO + admin).
