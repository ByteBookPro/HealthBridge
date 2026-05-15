# HealthBridge Vault

> 🏥 Premium cross-ecosystem health data bridge for Apple Watch, Galaxy Watch, Fitbit, and more.

![Version](https://img.shields.io/badge/version-4.2-blue)
![Expo](https://img.shields.io/badge/Expo-SDK%2052-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)

## 🌟 Features

- **Cross-Ecosystem Sync**: Bidirectional sync between Apple Health and Health Connect
- **8+ Watch Brands**: Apple Watch, Galaxy Watch, Pixel Watch, Fitbit, Garmin, Xiaomi, Huawei, Withings
- **Scientific Metrics**: HRV, VO2 Max, Sleep Score, Training Load, and more
- **AI Insights**: GPT-powered weekly health analysis (PRO)
- **Privacy Vault**: End-to-end encrypted health data

## 📱 Screenshots

| Dashboard | Metric Detail | Setup Wizard |
|-----------|---------------|---------------|
| Activity rings + metrics | Charts + scientific data | Universal watch setup |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB 6+
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure your variables
uvicorn server:api --reload --port 8001
```

### Frontend Setup
```bash
cd frontend
yarn install
cp .env.example .env  # Configure your variables
yarn start
```

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthbridge.app | ySk4rWp4nSn5KsB8WvI4iF |
| Demo | demo@healthbridge.app | Demo1234! |

## 📁 Project Structure

```
/app
├── backend/                 # FastAPI backend
│   ├── server.py           # Main API server (1500+ lines)
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── frontend/               # Expo React Native app
│   ├── app/               # File-based routing (expo-router)
│   │   ├── (tabs)/        # Tab navigation screens
│   │   ├── metric/        # Metric detail screens
│   │   ├── setup.tsx      # Universal setup wizard
│   │   └── ...            # Other screens
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React contexts (Auth)
│   │   ├── services/      # Native bridges
│   │   └── theme/         # Design tokens
│   └── package.json
├── memory/                 # Documentation
│   ├── PRD.md             # Product requirements
│   └── test_credentials.md
└── docs/                   # Technical docs
    ├── API.md             # API documentation
    ├── ARCHITECTURE.md    # System architecture
    ├── FRONTEND.md        # Frontend guide
    └── DEVELOPMENT.md     # Dev workflow
```

## 🔧 Configuration

### Backend Environment Variables
```env
MONGO_URL=mongodb://localhost:27017/healthbridge
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
EMERGENT_LLM_KEY=sk-emergent-...
```

### Frontend Environment Variables
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

## 📚 Documentation

- [Product Requirements (PRD)](/memory/PRD.md)
- [API Documentation](/docs/API.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)
- [Frontend Guide](/docs/FRONTEND.md)
- [Development Workflow](/docs/DEVELOPMENT.md)

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
yarn test
```

## 📄 License

Proprietary - All rights reserved.

## 🤝 Contributing

See [DEVELOPMENT.md](/docs/DEVELOPMENT.md) for contribution guidelines.
