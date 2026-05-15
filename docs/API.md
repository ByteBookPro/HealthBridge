# HealthBridge Vault - API Documentation

## Base URL
```
Production: https://api.healthbridge.app/api
Development: http://localhost:8001/api
```

## Authentication
All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /api/auth/register
Create a new user account with 30-day PRO trial.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### POST /api/auth/login
Authenticate existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK` (same as register)

### POST /api/auth/refresh
Refresh access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### GET /api/auth/me
Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "pro",
  "subscription": {
    "plan": "pro",
    "status": "active",
    "is_trial": true,
    "trial_days_left": 25
  }
}
```

### POST /api/auth/forgot-password
**Request:**
```json
{ "email": "user@example.com" }
```

### POST /api/auth/reset-password
**Request:**
```json
{
  "token": "reset-token",
  "new_password": "NewSecurePass123!"
}
```

---

## Metrics Endpoints

### GET /api/metrics/summary
Get all health metrics for the current user.

**Response:**
```json
[
  {
    "metric": "steps",
    "label": "Steps",
    "current": 12500,
    "goal": 10000,
    "unit": "steps",
    "trend": [11200, 10800, 12500, ...],
    "delta_pct": 8.5,
    "apple_value": 6500,
    "samsung_value": 6000
  },
  // ... other metrics
]
```

### GET /api/metrics/{metric}/detail
Get detailed metric data with scientific calculations.

**Query Parameters:**
- `time_range`: `day` | `week` | `month` | `year` (default: `week`)

**Response:**
```json
{
  "metric": "heart_rate",
  "current": 72,
  "goal": 70,
  "unit": "bpm",
  "trend": [71, 73, 72, ...],
  "apple_value": 72,
  "samsung_value": 71,
  "delta_pct": 2.1,
  "history": [
    { "date": "2026-05-14T00:00:00Z", "value": 71 },
    // ... more data points
  ],
  "statistics": {
    "avg": 71.5,
    "min": 58,
    "max": 142,
    "total": 500.5
  },
  "hourly": [
    { "hour": 0, "value": 62 },
    // ... 24 hours
  ],
  "scientific": {
    "resting_hr": 61,
    "max_hr": 185,
    "hrv": 45,
    "recovery_rate": 22,
    "fat_burn_minutes": 45,
    "cardio_minutes": 30,
    "peak_minutes": 12
  }
}
```

### POST /api/metrics/sync-now
Trigger manual sync from all connected sources.

**Response:**
```json
{
  "synced": 8,
  "timestamp": "2026-05-15T12:00:00Z"
}
```

### POST /api/metrics/ingest
Ingest health data from native bridge.

**Request:**
```json
{
  "samples": [
    {
      "metric": "steps",
      "value": 1250,
      "unit": "steps",
      "source": "apple",
      "recorded_at": "2026-05-15T10:30:00Z"
    }
  ]
}
```

---

## Health Setup Endpoints

### GET /api/health/platforms
Get list of supported health platforms and watches.

**Response:**
```json
{
  "platforms": [
    {
      "id": "apple_healthkit",
      "name": "Apple HealthKit",
      "os": "ios",
      "features": ["steps", "heart_rate", "sleep", "workouts", "spo2", "ecg"]
    },
    // ... more platforms
  ],
  "watches": [
    {
      "id": "apple",
      "name": "Apple Watch",
      "platforms": ["ios"],
      "sync_method": "healthkit"
    },
    // ... 8 watch brands
  ],
  "cross_ecosystem": {
    "supported": true,
    "description": "HealthBridge syncs data between Apple HealthKit and Health Connect",
    "limitations": ["Apple Watch requires iPhone for setup", ...]
  }
}
```

### POST /api/health/setup
Save user's health platform configuration.

**Request:**
```json
{
  "platform": "ios",
  "watches": ["apple", "fitbit"],
  "healthKitGranted": true,
  "healthConnectGranted": false
}
```

### GET /api/health/setup
Get user's current health setup.

---

## Watches Endpoints

### GET /api/watches
Get all connected watches for current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "platform": "apple",
    "model": "Apple Watch Series 9",
    "os_version": "watchOS 11",
    "battery": 85,
    "last_sync_at": "2026-05-15T11:30:00Z",
    "status": "connected"
  }
]
```

### POST /api/watches
Add a new watch.

### DELETE /api/watches/{id}
Remove a watch.

---

## Sync Endpoints

### GET /api/sync/events
Get sync history.

**Query Parameters:**
- `limit`: Number of events (default: 15)

### GET /api/sync/policy
Get sync configuration.

### PUT /api/sync/preferences
Update sync preferences.

---

## Goals Endpoints (PRO)

### GET /api/goals
Get all goals for current user.

### POST /api/goals
Create a new goal.

**Request:**
```json
{
  "metric": "steps",
  "target": 12000,
  "period": "daily"
}
```

### DELETE /api/goals/{id}
Delete a goal.

---

## Insights Endpoints (PRO)

### GET /api/insights
Get AI-generated insights.

### POST /api/insights/generate
Generate new AI insights.

### GET /api/reports/weekly
Get weekly health report.

---

## Admin Endpoints (ADMIN only)

### GET /api/admin/stats
Get platform statistics.

**Response:**
```json
{
  "total_users": 1250,
  "pro_users": 380,
  "active_subscriptions": 350,
  "mrr": 1747.50,
  "churn_rate": 2.5
}
```

### GET /api/admin/users
Get all users with pagination.

### PUT /api/admin/users/{id}/role
Update user role.

---

## Billing Endpoints

### POST /api/billing/create-checkout
Create Stripe checkout session.

### POST /api/billing/webhook
Stripe webhook handler.

### POST /api/billing/cancel
Cancel subscription.

---

## Vault Export Endpoints

### POST /api/vault/export
Export health data.

**Request:**
```json
{
  "format": "json",  // or "csv", "gpx"
  "date_from": "2026-01-01",
  "date_to": "2026-05-15",
  "metrics": ["steps", "heart_rate", "sleep"]
}
```

---

## Error Responses

### 400 Bad Request
```json
{ "detail": "Invalid request body" }
```

### 401 Unauthorized
```json
{ "detail": "Not authenticated" }
```

### 402 Payment Required
```json
{ "detail": "PRO subscription required" }
```

### 403 Forbidden
```json
{ "detail": "Admin access required" }
```

### 404 Not Found
```json
{ "detail": "Resource not found" }
```

### 500 Internal Server Error
```json
{ "detail": "Internal server error" }
```
