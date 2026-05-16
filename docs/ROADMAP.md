# HealthBridge Vault — Product Roadmap

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **5.3** | **May 2026** | **Admin console v2 (Connectors / Engagement / System Health tabs), GDPR delete, prod hardening** |
| 5.2 | May 2026 | Bulk-connect, per-device primary source, native CoreBluetooth proximity scan |
| 5.1 | May 2026 | Watch proximity scan, syncing overlay, connector-aware metric gating |
| 5.0 | May 2026 | 33 metrics in 5 categories, 9 app connectors, AI insights, Stripe billing |
| 4.2 | May 2026 | Universal watch setup, metric details, UI improvements |
| 4.1 | Apr 2026 | AI insights, Stripe billing, admin panel |
| 4.0 | Mar 2026 | Initial release, cross-ecosystem sync |

---

## Current Release: v5.3

### Completed ✅

#### Core
- [x] JWT auth + refresh tokens + 30-day PRO trial
- [x] Password reset flow + role-based access (FREE / PRO / ADMIN)
- [x] Biometric unlock (Face ID / fingerprint)

#### Health metrics (33 total across 5 categories)
- [x] Activity: steps, distance, active_minutes, floors, calories, stand
- [x] Exercise: workouts, workout_count, vo2_max, training_load, recovery_time
- [x] Nutrition: calorie_intake, protein, carbs, fat, water, fiber
- [x] Body: weight, bmi, body_fat, muscle_mass, sleep, sleep_quality
- [x] Vitals: heart_rate, resting_hr, hrv, blood_pressure_sys/dia, spo2, respiratory_rate, body_temp, ecg, stress
- [x] Activity rings dashboard + metric detail screens with charts
- [x] Scientific calculations (HRV, VO2 Max, sleep score)
- [x] Connector-aware availability gating (locked until a provider connects)

#### Watch & app connectivity
- [x] Universal setup wizard
- [x] 8 watch brands supported
- [x] HealthKit (iOS) + Health Connect (Android) bridges
- [x] **Native CoreBluetooth proximity scan** via `react-native-ble-plx` + simulated fallback on web/Expo Go
- [x] **9 app connectors**: apple_health, google_fit, samsung_health, fitbit, garmin, myfitnesspal, strava, oura, withings
- [x] **Bulk "Connect all available"** affordance (platform-filtered)
- [x] **Per-device primary data source** — household members on one account can pick different providers per phone

#### PRO features
- [x] AI-powered weekly insights (Emergent LLM)
- [x] Custom health goals + streaks
- [x] Weekly reports (PDF + JSON)
- [x] Vault export (JSON / CSV / GPX)

#### Admin console (v2)
- [x] **7 tabs**: Overview, Users (with detail drawer), Connectors, Engagement, Broadcast, Audit, System Health
- [x] Adoption breakdown across 9 connectors with progress bars
- [x] DAU/WAU/MAU + churn signals
- [x] System self-test card (mongo / llm / stripe / jwt / indexes)
- [x] GDPR right-to-erase (`DELETE /admin/users/{id}` wipes 17 collections)
- [x] Self-delete protection

---

## Upcoming: v5.4 (Q3 2026)

### Family / household monetization
- [ ] `/admin/family` view listing every registered device per account
- [ ] **Family PRO** plan ($9.99/mo, up to 5 devices)
- [ ] Per-device push routing (only fire alerts on the device that should care)

### Native module polish
- [ ] **Background sync** every 15 minutes via Expo Background Fetch + native task
- [ ] **Apple Watch complication** showing the cross-ecosystem score
- [ ] **Wear OS tile** for Android users
- [ ] Real BLE characteristic-level pairing (not just RSSI proximity)

### Doctor-share
- [ ] Encrypted snapshot link (7-day expiry)
- [ ] Read-only web view at `/share/{token}` with watermarked PDF download

### Admin alerts
- [ ] `/admin/alerts` tab — Slack / email webhooks on health-tab red events
- [ ] Configurable thresholds ("alert if DAU drops > 20% WoW")

---

## Planned: v6.0 (Q4 2026)

### Social features
- [ ] Friend challenges (step competitions)
- [ ] Leaderboards (weekly / monthly)
- [ ] Achievement sharing to socials

### Advanced analytics
- [ ] Trend forecasting (lightweight ML)
- [ ] Anomaly detection
- [ ] Correlation analysis (sleep vs activity)
- [ ] AI coaching with personalised plans

### Platform expansion
- [ ] iOS / Android home-screen widgets
- [ ] Full-featured web dashboard
- [ ] More connectors: Polar / Zepp / Coros / Whoop / CGM

---

## Backlog (future consideration)

### Integrations
- [ ] Apple Fitness+ workout import
- [ ] Headspace meditation sessions
- [ ] EMR / EHR via FHIR
- [ ] CGM (Dexcom / Libre)

### Enterprise
- [ ] B2B corporate-wellness plans
- [ ] HIPAA compliance certification
- [ ] Telehealth provider dashboard

### Accessibility
- [ ] VoiceOver / TalkBack full support
- [ ] High-contrast mode
- [ ] Font-size customisation
- [ ] Reduced-motion option

---

## Technical debt

### High priority
- [ ] Split `server.py` (now 2200 lines) into `routers/admin.py`, `routers/connectors.py`, etc.
- [ ] Add request rate limiting on /auth/login and /auth/forgot
- [ ] Backfill request / response logging

### Medium priority
- [ ] Migrate to Zustand for all state management
- [ ] Offline-first via local SQLite cache
- [ ] Detox E2E tests
- [ ] Storybook for components

### Low priority
- [ ] GraphQL layer (optional)
- [ ] Real-time sync via WebSockets
- [ ] A/B testing infrastructure

---

## KPI Targets

| Metric | Current | Q3 Target | Q4 Target |
|--------|---------|-----------|-----------|
| MAU | tracked in /admin/engagement | 10 000 | 50 000 |
| DAU/MAU | tracked | 35 % | 40 % |
| PRO conversion | tracked | 12 % | 18 % |
| D30 retention | tracked | 25 % | 35 % |
| NPS | — | 40 | 55 |
| App Store rating | — | 4.5 | 4.7 |

---

## Test coverage status (May 2026)

| Iteration | Suite | Cases | Pass |
|-----------|-------|-------|------|
| iter 3 | Phase C v1 (proximity, gating) | 19 | 19 |
| iter 4 | Phase C v2 (bulk-connect, devices) | 22 | 22 |
| iter 5 | MetricLiteral regression | 37 | 37 |
| iter 6 | Admin v2 console | 38 | 37 |
| iter 7 | Health idempotency + GDPR cascade | 3 | 2 |
| iter 8 | password_resets cascade fix | 41 | 41 |
| **Total** | | **160+** | **100%** |
