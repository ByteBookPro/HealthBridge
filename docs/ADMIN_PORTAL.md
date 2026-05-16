# Admin Portal Guide (v5.3)

Open `/admin` while signed in as an admin. The route is an Expo Router screen so it
works in any browser and on a signed-in mobile build (Settings → "Open Admin Portal").

## Default admin
- email: `admin@healthbridge.app`
- password: `ySk4rWp4nSn5KsB8WvI4iF` *(rotate before production)*

```bash
# Set on the backend .env
ADMIN_EMAIL=ops@yourbrand.com
ADMIN_PASSWORD=$(openssl rand -hex 16)
```
The seed is idempotent — re-running the backend with a new password updates the
existing record.

## Tabs (7)

### 1. Overview
Six KPI tiles:
- Total users, PRO subscribers, MRR (computed from `active_subs × $4.99`)
- Syncs in last 24h, Active subscriptions, Push notifications sent

Quick actions: **Refresh stats**, **Sign out**.

### 2. Users (CRM + GDPR drawer)
- Search by email (case-insensitive regex).
- Per-user inline actions: **Grant PRO** (`POST /api/admin/users/{id}/plan?plan=pro`),
  **Cancel subscription** (`POST /api/admin/users/{id}/cancel?immediate=true`,
  also tells Stripe to cancel).
- Admin users have an `ADMIN` chip and skip inline edit actions.
- **Tap any row** → slide-up **user detail modal** (`/api/admin/users/{id}` GET) with:
  - subscription plan / status pills
  - connected apps (icon + last_sync_at)
  - registered devices (label + platform + last seen)
  - recent sync events (last 10)
  - goals
  - **Delete user (GDPR)** red button — `DELETE /api/admin/users/{id}`.
    Refused for the admin's own account (400). Wipes 16+ collections + password_resets.

### 3. Connectors
- Adoption % across **9 connectors** (apple_health, google_fit, samsung_health,
  fitbit, garmin, myfitnesspal, strava, oura, withings) sorted by connected_seats desc.
- Each row: connector icon (tinted), `connected/total` users, progress bar, big `%`.
- Below the list: **Device profile distribution** card with 4 stats
  (Total devices / Multi-device users / Max per user / Avg per user) +
  per-platform breakdown chips (ios/android/web counts).

Backed by `GET /api/admin/connectors/stats` and `GET /api/admin/devices/stats`.

### 4. Engagement
Six numeric tiles + a churn section.
- **DAU / WAU / MAU**: distinct users with sync events in the trailing 1d / 7d / 30d windows.
- **WAU/DAU**: stickiness ratio (≥ 0.4 is healthy).
- **New signups (24h / 7d)**.
- **Churn signals**: count of subscriptions with `cancel_at_period_end=true` while `status=active`, plus the churn % over PRO users.

Backed by `GET /api/admin/engagement`.

### 5. Broadcast
- Send a push notification to **every** user with a registered Expo push token.
- Backed by `POST /api/admin/broadcast { title, body, data? }`.
- Users without tokens are skipped silently.

### 6. Audit
- Last 100 sync events globally (`source → destination`, timestamp).
- Last 100 push notifications globally with delivery status.

Backed by `GET /api/admin/audit`.

### 7. System Health
Read-only self-test card with 5 checks:
- **mongo** — `db.command('ping')` succeeds
- **emergent_llm_key** — present & non-empty
- **stripe** — current key mode (`live` / `test` / `dev_fallback`)
- **jwt** — secret length ≥ 16 chars
- **indexes** — verifies 6 expected index groups exist (uses `list_indexes`, NOT `create_index`, so this endpoint is idempotent and safe to poll)

The top header aggregates every child check — flips to red **Issues detected** as
soon as any of them fails.

Below: **Stripe billing card** with mode chip, masked API key, webhook secret
status, and a live reachability ping when a real `sk_test_*` or `sk_live_*` key
is configured (uses `stripe.Balance.retrieve()` lightly).

Backed by `GET /api/admin/health` and `GET /api/admin/billing/health`.

---

## Endpoints (admin scope)
All require `current_user.is_admin == True`. Non-admin → 403, no auth → 401.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/stats` | KPI tiles |
| GET | `/api/admin/users?q=` | List/search users |
| GET | `/api/admin/users/{id}` | User detail (subs/watches/connectors/devices/syncs/goals) |
| POST | `/api/admin/users/{id}/plan?plan=` | Grant/revoke PRO |
| POST | `/api/admin/users/{id}/cancel?immediate=` | Cancel Stripe sub |
| DELETE | `/api/admin/users/{id}` | GDPR right-to-erase (blocks self) |
| POST | `/api/admin/broadcast` | Push every user |
| GET | `/api/admin/audit` | Global sync + notification feed |
| GET | `/api/admin/billing/health` | Stripe key mode + reachability |
| GET | `/api/admin/connectors/stats` | Per-connector adoption |
| GET | `/api/admin/devices/stats` | Device profile distribution |
| GET | `/api/admin/engagement` | DAU/WAU/MAU + churn |
| GET | `/api/admin/health` | System self-test |

## GDPR delete cascade
`DELETE /api/admin/users/{user_id}` cleans these collections by `user_id`:
`watches, metric_summaries, sync_prefs, sync_events, conflict_policy, goals,
insights, metric_primary, connectors, user_devices, notifications, push_tokens,
migration_jobs, notif_bridge_settings, notif_bridge_log, health_setup,
password_resets, users`.

- Self-delete is refused (400) — admins can't lock themselves out.
- INFO log records only `user_id` (no email PII).
- Verified by `test_healthbridge_v8_admin_console.py` (TestGdprDeleteCascade).
