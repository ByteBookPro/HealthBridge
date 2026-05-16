# HealthBridge Vault

> 🏥 Premium cross-ecosystem health-data bridge for Apple Watch, Galaxy Watch, Fitbit, Garmin, Oura, Withings and more.

![Version](https://img.shields.io/badge/version-5.3-blue)
![Expo](https://img.shields.io/badge/Expo-SDK%2052-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)
![Tests](https://img.shields.io/badge/tests-160%2B%20passing-brightgreen)

## 🌟 Features

- **33 health metrics across 5 categories** (Activity, Exercise, Nutrition, Body, Vitals)
- **9 app connectors**: Apple Health, Google Fit, Samsung Health, Fitbit, Garmin, MyFitnessPal, Strava, Oura, Withings
- **Cross-ecosystem sync** between Apple Health and Health Connect (bidirectional)
- **Native CoreBluetooth proximity scan** (`react-native-ble-plx`) — only connect a watch when it's actually in range
- **Per-device primary source** — households on one account can pick different providers per phone
- **Connector-aware dashboard** — metric cards stay locked until a connected app provides data
- **AI Insights** powered by Emergent LLM (PRO)
- **Stripe billing** with self-serve checkout / portal + webhook-driven sub state
- **Admin console** with 7 tabs: Overview / Users / Connectors / Engagement / Broadcast / Audit / System Health
- **GDPR right-to-erase** that cascades to 17 collections
- **Biometric unlock** (Face ID / fingerprint)

## 📱 Screens

| Dashboard | Metric detail | Watches | Customize metrics | Admin |
|---|---|---|---|---|
| Activity rings + 33 metrics, locked-until-connected gating | Charts + scientific context | Proximity scan modal before connect | Toggle + per-device primary picker | 7 tabs incl. adoption & engagement |

## 🚀 Quick Start

### Prerequisites
- Node 18+ · Python 3.11+ · MongoDB 6+ · Yarn 1.22+

### Backend
```bash
cd backend
pip install -r requirements.txt
# Configure .env (see below)
uvicorn server:api --reload --port 8001
```

### Frontend (Expo Web)
```bash
cd frontend
yarn install
# Configure .env (see below)
yarn start            # serves expo web on :3000
```

For native dev builds use `eas build --profile development --platform ios|android`
and follow `/app/docs/EAS_BUILD.md`.

### Test credentials (seeded automatically)

| Account | Email | Password |
|---------|-------|----------|
| Admin + PRO | `admin@healthbridge.app` | `ySk4rWp4nSn5KsB8WvI4iF` |
| Demo (30-day PRO trial) | `demo@healthbridge.app` | `Demo1234!` |

## 📁 Project structure

```
/app
├── backend/                     FastAPI service (~2 200 lines)
│   ├── server.py               · all endpoints, models, seed
│   ├── requirements.txt
│   ├── tests/                  · pytest (160+ green cases)
│   └── .env
├── frontend/                    Expo Router app (iOS / Android / Web)
│   ├── app/                    · file-based routes
│   │   ├── (tabs)/             · dashboard, vault, sync, settings, watches
│   │   ├── admin/              · 7-tab admin portal
│   │   ├── app-connectors.tsx  · 9 connectors + bulk-connect
│   │   ├── customize-metrics.tsx · per-device primary picker
│   │   ├── metric/[id].tsx     · charts & detail
│   │   └── setup.tsx           · universal setup wizard
│   ├── src/
│   │   ├── api/client.ts       · typed API client
│   │   ├── components/         · SyncingOverlay, ProximityScanModal …
│   │   ├── context/            · AuthContext
│   │   ├── hooks/useDevice.ts  · per-device id + auto-register
│   │   ├── services/healthBridge.ts · HK / HC / BLE proximity
│   │   ├── theme/              · design tokens
│   │   └── utils/storage/      · SecureStore + AsyncStorage abstraction
│   └── package.json
├── memory/                      Living docs
│   ├── PRD.md                  · evolving product spec
│   └── test_credentials.md
└── docs/                        Reference docs
    ├── API.md                  · endpoint reference (incl. Phase C + Admin v2)
    ├── ADMIN_PORTAL.md         · admin console guide (7 tabs)
    ├── ARCHITECTURE.md         · system architecture
    ├── ROADMAP.md              · version history + backlog + KPIs
    ├── FRONTEND.md             · Expo build / patterns
    ├── DEVELOPMENT.md          · contributor workflow
    ├── DEPLOYMENT_CHECKLIST.md · production cut-over steps
    ├── EAS_BUILD.md            · native build instructions
    ├── NATIVE_BRIDGE.md        · HealthKit + Health Connect + BLE
    ├── NOTIFICATION_BRIDGE.md  · cross-watch notification forwarding
    ├── PRIVACY_POLICY.md
    └── TERMS.md
```

## 🔧 Configuration

### `backend/.env`
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=healthbridge

JWT_SECRET=replace_with_32+_char_random_in_prod
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=14

# Stripe — flip from sk_test_emergent to a real key for live billing
STRIPE_API_KEY=sk_test_emergent
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=price_hbv_pro_monthly_499

APP_PUBLIC_URL=https://your-app.preview.emergentagent.com

# Admin auto-seed (idempotent — change to rotate)
ADMIN_EMAIL=admin@healthbridge.app
ADMIN_PASSWORD=ySk4rWp4nSn5KsB8WvI4iF
ADMIN_NAME=HBV Admin

# Emergent universal LLM key (Anthropic / OpenAI / Gemini routing)
EMERGENT_LLM_KEY=sk-emergent-...
```

### `frontend/.env`
```env
EXPO_PUBLIC_BACKEND_URL=https://your-app.preview.emergentagent.com
```

## 📚 Documentation

- [Product Requirements (PRD)](memory/PRD.md)
- [API Reference](docs/API.md) — 80+ endpoints including Phase C (Connectors / Devices / Proximity) and Admin v2
- [Admin Portal Guide](docs/ADMIN_PORTAL.md) — 7 tabs, GDPR cascade, system health
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md) — versions, KPI targets, technical debt
- [Native Bridge](docs/NATIVE_BRIDGE.md) — HealthKit, Health Connect, BLE proximity
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)

## 🧪 Testing

```bash
# Backend (pytest)
cd backend && pytest tests/ -v
# 160+ cases across iter 3-8 — all green

# Frontend (Expo Web on :3000)
cd frontend && yarn start
# E2E via testing_agent_v3 in this repo's tooling
```

## ✅ Production checklist (flip-to-live)

1. Rotate `JWT_SECRET` (≥32 char random) — `/admin/health` verifies length
2. Swap `STRIPE_API_KEY` → real `sk_test_*` or `sk_live_*`
3. Set `STRIPE_WEBHOOK_SECRET` → real `whsec_...`
4. Set Apple Push / Firebase credentials (Expo handles routing)
5. Rotate `ADMIN_PASSWORD`
6. Run the GET `/api/admin/health` smoke — all 5 checks must be green
7. Read `docs/DEPLOYMENT_CHECKLIST.md` for the full kit (icons, EAS, store assets)

## 📄 License

Proprietary — All rights reserved.

## 🤝 Contributing

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
