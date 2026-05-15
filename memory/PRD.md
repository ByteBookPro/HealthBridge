# HealthBridge Vault - Product Requirements Document (PRD)

## Version 4.2 | Last Updated: May 2026

---

## 1. Product Vision

**HealthBridge Vault** is a premium cross-ecosystem health data bridge that unifies health metrics from Apple Watch, Galaxy Watch, Fitbit, Garmin, and other wearables into a single, beautifully designed mobile application. It breaks the Apple/Android ecosystem barrier by syncing health data bidirectionally.

### Core Value Proposition
- **Cross-Ecosystem Sync**: Apple Health ↔ Health Connect (Android) bidirectional sync
- **Universal Watch Support**: Connect any smartwatch regardless of phone platform
- **AI-Powered Insights**: GPT-powered weekly health reports and recommendations
- **Privacy-First**: End-to-end encrypted health data vault
- **Scientific Metrics**: Hospital-grade health calculations and analysis

---

## 2. Target Users

### Primary Personas
1. **Cross-Platform Families**: iPhone user with Samsung watch, or Android user wanting Apple Health data
2. **Health Enthusiasts**: Users who want detailed scientific analysis of their health metrics
3. **Multi-Device Users**: People with multiple wearables (Fitbit for sleep, Apple Watch for workouts)
4. **Privacy-Conscious Users**: Those wanting encrypted, self-controlled health data

---

## 3. Feature Specifications

### 3.1 Authentication System
| Feature | Status | Description |
|---------|--------|-------------|
| Email/Password Auth | ✅ Done | JWT-based authentication |
| Password Reset | ✅ Done | Email-based reset flow |
| Token Refresh | ✅ Done | Auto-refresh before expiry |
| Role-Based Access | ✅ Done | FREE, PRO, ADMIN roles |
| 30-Day PRO Trial | ✅ Done | New users get PRO features free |

### 3.2 Health Metrics Dashboard
| Metric | Scientific Calculations | Status |
|--------|------------------------|--------|
| Steps | Distance, Calories, Active Minutes, Cadence, Step Asymmetry | ✅ Done |
| Heart Rate | Resting HR, Max HR, HRV (RMSSD), Recovery Rate, HR Zones | ✅ Done |
| Sleep | Deep/Light/REM stages, Sleep Score, Efficiency, Sleep Debt | ✅ Done |
| Workouts | VO2 Max, Training Load (TRIMP), Recovery Time | ✅ Done |
| SpO2 | Avg/Min, Night Average, Low O2 Events, Respiratory Rate | ✅ Done |
| ECG | PR/QRS/QT Intervals, QTc, Rhythm Classification | ✅ Done |
| Calories | BMR, TDEE, Active/Resting split, Net Calories | ✅ Done |
| Stand | Stand Hours, Sedentary Time, Movement Breaks | ✅ Done |

### 3.3 Metric Detail Screens
| Feature | Status | Description |
|---------|--------|-------------|
| Historical Charts | ✅ Done | Day/Week/Month/Year views with SVG charts |
| Statistics | ✅ Done | Avg, Min, Max, Total calculations |
| Week Comparison | ✅ Done | This Week vs Last Week visual comparison |
| Health Tips | ✅ Done | Personalized tips per metric type |
| Source Badges | ✅ Done | Shows Apple/Samsung data origins |
| Heart Rate Zones | ✅ Done | Fat Burn/Cardio/Peak zone breakdown |
| Sleep Stages | ✅ Done | Visual sleep stage composition |

### 3.4 Universal Watch Connectivity
| Feature | Status | Description |
|---------|--------|-------------|
| Platform Detection | ✅ Done | Auto-detect iOS/Android/Web |
| Watch Selection | ✅ Done | 8 brands: Apple, Samsung, Google, Fitbit, Garmin, Xiaomi, Huawei, Withings |
| HealthKit Integration | ✅ Done | Native iOS health bridge |
| Health Connect | ✅ Done | Android unified health API |
| Permission Flow | ✅ Done | Step-by-step permission requests |
| Setup Wizard | ✅ Done | Guided setup experience |

### 3.5 PRO Features (Subscription)
| Feature | Status | Description |
|---------|--------|-------------|
| AI Weekly Insights | ✅ Done | GPT-powered health analysis |
| Custom Goals | ✅ Done | Set personal health targets |
| Weekly Reports | ✅ Done | Detailed PDF-style reports |
| Stripe Billing | ✅ Done | $4.99/month subscription |
| Vault Export | ✅ Done | JSON/CSV/GPX export options |

### 3.6 Admin Features
| Feature | Status | Description |
|---------|--------|-------------|
| User Management | ✅ Done | View/manage all users |
| KPI Dashboard | ✅ Done | Total users, PRO users, revenue |
| Subscription Stats | ✅ Done | MRR, churn rate analytics |

---

## 4. Technical Requirements

### 4.1 Stack
- **Frontend**: Expo (React Native) with TypeScript
- **Backend**: FastAPI (Python 3.11+)
- **Database**: MongoDB
- **Auth**: JWT with bcrypt password hashing
- **AI**: Emergent LLM Integration (OpenAI-compatible)
- **Payments**: Stripe (test mode configured)

### 4.2 API Endpoints Summary
See `/app/docs/API.md` for complete documentation.

### 4.3 Environment Variables
```
# Backend (.env)
MONGO_URL=mongodb://localhost:27017/healthbridge
JWT_SECRET=<random-secret>
STRIPE_SECRET_KEY=sk_test_...
EMERGENT_LLM_KEY=sk-emergent-...

# Frontend (.env)
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PACKAGER_PROXY_URL=<tunnel-url>
```

---

## 5. Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin + PRO | admin@healthbridge.app | ySk4rWp4nSn5KsB8WvI4iF |
| Free User | demo@healthbridge.app | Demo1234! |

---

## 6. Screens & Navigation

### Tab Navigation
1. **Dashboard** (`/(tabs)/index.tsx`) - Activity rings, metric grid
2. **Watches** (`/(tabs)/watches.tsx`) - Connected devices
3. **Sync** (`/(tabs)/sync.tsx`) - Sync history and settings
4. **Insights** (`/(tabs)/insights.tsx`) - AI-powered analysis (PRO)
5. **Profile** (`/(tabs)/profile.tsx`) - Settings, subscription

### Stack Screens
- `/login` - Authentication
- `/register` - New account
- `/onboarding` - First-time setup
- `/setup` - Universal watch connectivity wizard
- `/metric/[type]` - Detailed metric view
- `/connect` - Bridge setup guide
- `/notifications` - Notification preferences
- `/admin` - Admin dashboard (ADMIN only)

---

## 7. Pending/Future Features

### High Priority
- [ ] Real HealthKit/Health Connect native module integration (requires EAS build)
- [ ] Fitbit OAuth integration
- [ ] Garmin Connect API integration
- [ ] Push notifications for goal completion

### Medium Priority
- [ ] Social features (share achievements)
- [ ] Apple Watch companion app
- [ ] Widget for iOS/Android home screen
- [ ] Dark/Light theme toggle

### Low Priority
- [ ] Wear OS companion app
- [ ] Web dashboard
- [ ] Family sharing plan
- [ ] Integration with Apple Fitness+

---

## 8. Known Limitations

1. **Apple Watch on Android**: Not possible due to Apple's Activation Lock. App can only bridge historical data via Migration Wizard.
2. **ECG Write**: Cannot write ECG data to Health Connect (read-only by Google's policy)
3. **Real-time Sync**: Requires EAS dev build for native modules; Expo Go uses simulated data
4. **Stripe Payments**: Currently in test mode; production keys needed for App Store

---

## 9. Success Metrics

- **User Activation**: 70% of users complete setup wizard
- **Retention**: 40% DAU/MAU ratio
- **Conversion**: 15% free-to-PRO conversion after trial
- **NPS**: Target 50+ Net Promoter Score
