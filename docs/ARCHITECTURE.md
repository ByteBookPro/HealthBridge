# HealthBridge Vault - System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   iOS App    │  │ Android App  │  │  Web Preview │          │
│  │  (Expo Go)   │  │  (Expo Go)   │  │  (localhost) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│              ┌────────────▼────────────┐                        │
│              │   Native Health Bridge   │                       │
│              │  (HealthKit/HealthConnect)│                      │
│              └────────────┬────────────┘                        │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ HTTPS/WSS
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                        API Layer                                 │
├───────────────────────────┼─────────────────────────────────────┤
│              ┌────────────▼────────────┐                        │
│              │     FastAPI Server      │                        │
│              │      (Python 3.11)      │                        │
│              │    - JWT Auth           │                        │
│              │    - CORS enabled       │                        │
│              │    - Rate limiting      │                        │
│              └────────────┬────────────┘                        │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                   │
│   ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐              │
│   │  MongoDB  │    │  Stripe   │    │ Emergent  │              │
│   │ Database  │    │  Billing  │    │   LLM     │              │
│   └───────────┘    └───────────┘    └───────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|----------|
| Expo | SDK 52 | React Native framework |
| expo-router | 4.x | File-based navigation |
| React Native | 0.76 | UI framework |
| TypeScript | 5.3 | Type safety |
| react-native-reanimated | 3.16 | Animations |
| react-native-svg | 15.9 | Charts/Graphics |
| expo-secure-store | 14.0 | Secure token storage |
| zustand | 5.0 | State management |

### Backend
| Technology | Version | Purpose |
|------------|---------|----------|
| FastAPI | 0.115 | API framework |
| Python | 3.11+ | Runtime |
| Motor | 3.7 | Async MongoDB driver |
| PyJWT | 2.10 | JWT authentication |
| bcrypt | 4.2 | Password hashing |
| Stripe | 13.0+ | Payment processing |
| emergentintegrations | 0.1 | LLM integration |

### Infrastructure
| Technology | Purpose |
|------------|----------|
| MongoDB | Primary database |
| Redis (optional) | Caching, rate limiting |
| Nginx | Reverse proxy |
| Docker | Containerization |

## Database Schema

### Collections

#### users
```javascript
{
  id: "uuid",
  email: "user@example.com",
  password_hash: "$2b$12$...",
  name: "John Doe",
  role: "pro", // "free" | "pro" | "admin"
  subscription: {
    plan: "pro",
    status: "active",
    stripe_customer_id: "cus_...",
    stripe_subscription_id: "sub_...",
    current_period_end: ISODate(),
    is_trial: true,
    trial_end: ISODate()
  },
  created_at: ISODate(),
  updated_at: ISODate()
}
```

#### metric_summaries
```javascript
{
  user_id: "uuid",
  metric: "steps",
  label: "Steps",
  current: 12500,
  goal: 10000,
  unit: "steps",
  trend: [11200, 10800, 12500, ...], // Last 14 days
  delta_pct: 8.5,
  apple_value: 6500,
  samsung_value: 6000,
  updated_at: ISODate()
}
```

#### watches
```javascript
{
  id: "uuid",
  user_id: "uuid",
  platform: "apple", // "apple" | "samsung" | "fitbit" | etc.
  model: "Apple Watch Series 9",
  os_version: "watchOS 11",
  battery: 85,
  last_sync_at: ISODate(),
  status: "connected",
  created_at: ISODate()
}
```

#### sync_events
```javascript
{
  id: "uuid",
  user_id: "uuid",
  metric: "steps",
  source: "apple",
  destination: "cloud",
  value: 1250,
  unit: "steps",
  status: "success",
  created_at: ISODate()
}
```

#### goals
```javascript
{
  id: "uuid",
  user_id: "uuid",
  metric: "steps",
  target: 12000,
  period: "daily",
  created_at: ISODate()
}
```

#### health_setups
```javascript
{
  user_id: "uuid",
  platform: "ios",
  watches: ["apple", "fitbit"],
  health_kit_granted: true,
  health_connect_granted: false,
  setup_completed: true,
  updated_at: ISODate()
}
```

#### insights
```javascript
{
  id: "uuid",
  user_id: "uuid",
  title: "Great Sleep Week!",
  body: "Your sleep quality improved by 15%...",
  category: "sleep",
  priority: "medium",
  created_at: ISODate()
}
```

## Security Architecture

### Authentication Flow
```
1. User submits credentials
2. Server validates against bcrypt hash
3. Server generates JWT (access + refresh tokens)
4. Client stores tokens in SecureStore
5. Client includes Bearer token in all API requests
6. Server validates JWT on each request
7. Auto-refresh before expiry
```

### Token Structure
```javascript
// Access Token (1 hour)
{
  sub: "user-uuid",
  role: "pro",
  iat: 1715788800,
  exp: 1715792400
}

// Refresh Token (30 days)
{
  sub: "user-uuid",
  type: "refresh",
  iat: 1715788800,
  exp: 1718380800
}
```

### Data Encryption
- Passwords: bcrypt with cost factor 12
- Tokens: HS256 JWT signing
- API: HTTPS/TLS 1.3
- Health data: AES-256-GCM at rest (future)

## Health Data Flow

### Sync Process
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Apple Watch │────▶│  HealthKit  │────▶│ Health      │
│             │     │  (iOS)      │     │ Bridge      │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Backend    │
                                        │  API        │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  MongoDB    │
                                        └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Galaxy Watch│◀────│  Health     │◀────│ Health      │
│             │     │  Connect    │     │ Bridge      │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Scalability Considerations

### Current Architecture (MVP)
- Single FastAPI instance
- Single MongoDB instance
- Stateless JWT auth

### Production Scaling
1. **Horizontal Scaling**: Multiple FastAPI instances behind load balancer
2. **Database**: MongoDB replica set, sharding by user_id
3. **Caching**: Redis for frequently accessed data
4. **Queue**: Celery/Redis for background sync jobs
5. **CDN**: Static assets via CloudFront/Cloudflare

## Monitoring & Observability

### Recommended Stack
- **Logging**: Structured JSON logs → ELK/CloudWatch
- **Metrics**: Prometheus + Grafana
- **Tracing**: OpenTelemetry
- **Errors**: Sentry
- **Uptime**: Pingdom/UptimeRobot
