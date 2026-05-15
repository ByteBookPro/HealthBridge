# HealthBridge Vault — PRD (v4)

## Vision
Premium cross-ecosystem health-data bridge with **subscription-worthy** PRO features:
AI-powered weekly insights, goals, weekly reports, multi-watch bridging, notification mirror, history migration wizard, full publishing kit, and a web admin portal.

## Stack
- **Frontend**: Expo SDK 54 + expo-router + reanimated + svg + glassmorphism design system + 18 routes.
- **Backend**: FastAPI + Motor (MongoDB), bcrypt + JWT, Stripe (dev-mode fallback), Expo Push, **emergentintegrations LlmChat (openai/gpt-4o-mini)** for AI insights.

## Implemented features

### Public / Free
- Onboarding (honest copy: health bridge + iPhone notifs → Galaxy Watch)
- Email/password register + login + forgot-password
- Dashboard with bridge status, Activity Rings, metric cards, sync-now
- Watches tab (connect/disconnect, Connect Wizard, Notification Bridge entry)
- Sync tab (per-metric toggles, conflict policy, audit log)
- Vault (biometric gate, JSON/CSV/GPX export)
- Settings (profile, sign-out, notifications, audit shortcuts)
- Connect Wizard (`/connect`) — honest path selection
- Notification Bridge (`/notifications`) — apps allow-list, live log
- Migration Wizard (`/migrate`) — 90-day history with progress bar

### PRO ($4.99/mo)
- **AI Health Insights** (`/insights`) — uses Emergent LLM (gpt-4o-mini) to generate 4 personalized findings from the user's last 14 days of bridged metrics, with severity + action
- **Weekly Report** — 7-day stats per metric (avg/min/max/change-pct)
- **Goals** — per-metric daily/weekly targets with progress + streak
- **Multi-watch bridge** (Apple + Galaxy in parallel)
- **Unlimited export**
- **Priority Stripe Customer Portal** for self-service

### Admin (`/admin`)
- 6-tile KPI overview (Total users, PRO, MRR, Syncs 24h, Active subs, Pushes)
- Users CRM (search, grant PRO, cancel sub)
- Broadcast push
- Global audit log

### Backend `/api`
- `/auth/*` (register, login, refresh, me, PATCH, change-password, forgot, reset)
- `/watches`, `/watches/{id}/toggle`
- `/metrics/summary`, `/metrics/sync-now`, `/metrics/ingest` (native bridge)
- `/sync/preferences`, `/sync/policy`, `/sync/events`
- `/vault/export`
- `/billing/checkout`, `/billing/portal`, `/billing/webhook`
- `/push/register`, `/push/test`
- `/admin/stats`, `/admin/users`, set plan, cancel sub, broadcast, audit
- `/migrate/start`, `/migrate/jobs/{id}`, `/migrate/jobs`
- `/bridge/notifications/{settings,event,log}`
- **PRO**: `/goals` CRUD, `/reports/weekly`, `/insights/generate`, `/insights`

## PRO gating
- `pro_only()` helper guards `/goals POST`, `/reports/weekly`, `/insights/generate` → HTTP 402 for FREE users.
- Frontend `/insights` route shows a paywall card with "Upgrade to PRO" CTA when `user.subscription.plan !== 'pro'`.

## Native bridge code (drop-in for EAS dev build)
- `/app/frontend/src/services/healthBridge.ts` (HealthKit + Health Connect)
- `/app/frontend/src/services/notificationBridge.ts` (BLE ANS + Android Notif Listener)
- Both use `require()` inside try/catch — Expo Go preview falls back to demo, EAS dev build activates real native APIs.

## Documentation
- `/app/docs/ARCHITECTURE.md`
- `/app/docs/NATIVE_BRIDGE.md`
- `/app/docs/NOTIFICATION_BRIDGE.md`
- `/app/docs/EAS_BUILD.md`
- `/app/docs/PUBLISHING_KIT.md`
- `/app/docs/DATA_SAFETY.md`
- `/app/docs/PRIVACY_POLICY.md`
- `/app/docs/TERMS.md`
- `/app/docs/ADMIN_PORTAL.md`
- `/app/docs/DEPLOYMENT_CHECKLIST.md`

## Test credentials (`/app/memory/test_credentials.md`)
- FREE: `demo@healthbridge.app` / `Demo1234!`
- Admin + PRO (auto-seeded): `admin@healthbridge.app` / `ySk4rWp4nSn5KsB8WvI4iF`
