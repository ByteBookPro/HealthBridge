# Admin Portal Guide

Open `/admin` while signed in as an admin (default seed below).

## Default admin
- email: `admin@healthbridge.app`
- password: `Admin1234!`

Change immediately in production:
```bash
# Set on the backend
ADMIN_EMAIL=ops@yourbrand.com
ADMIN_PASSWORD=$(openssl rand -hex 16)
```
The seed is idempotent — re-running with a new password updates the existing record.

## Tabs

### Overview
6 KPI tiles:
- Total users, PRO subscribers, MRR (computed from active subs × $4.99)
- Syncs in last 24h, Active subscriptions, Push notifications sent

### Users (CRM)
- Search by email.
- Per-user actions: **Grant PRO** (`/api/admin/users/{id}/plan?plan=pro`), **Cancel subscription** (`/api/admin/users/{id}/cancel?immediate=true`, also calls Stripe to cancel).
- Admin users have an `ADMIN` chip and are read-only.

### Broadcast
- Send a push notification to **every** user with a registered Expo push token.
- Backed by `POST /api/admin/broadcast { title, body, data }`.

### Audit
- Last 100 sync events globally.
- Last 100 push notifications globally with delivery status.

## Web admin
The portal is just an expo-router route — it works in any browser at:
```
https://your-app.com/admin
```
On mobile, signed-in admins also see an "Open Admin Portal" entry in Settings.
