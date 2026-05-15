# HealthBridge Vault - Development Guide

## Getting Started

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **Python** 3.11+
- **MongoDB** 6.0+
- **Yarn** 1.22+
- **Expo CLI**: `npm install -g expo-cli`

### Initial Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-org/healthbridge-vault.git
cd healthbridge-vault
```

2. **Backend setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017/healthbridge
JWT_SECRET=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PRICE_ID=price_your_price_id
EMERGENT_LLM_KEY=sk-emergent-your_key
EOF

# Start server
uvicorn server:api --reload --port 8001
```

3. **Frontend setup**
```bash
cd frontend
yarn install

# Create .env file
cat > .env << EOF
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EOF

# Start Expo
yarn start
```

4. **Seed the database**
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@healthbridge.app","password":"ySk4rWp4nSn5KsB8WvI4iF","name":"Admin User"}'
```

## Development Workflow

### Branch Strategy
```
main          # Production-ready code
├── develop   # Integration branch
│   ├── feature/metric-detail    # Feature branches
│   ├── feature/stripe-billing
│   └── bugfix/auth-refresh
└── hotfix/   # Production hotfixes
```

### Commit Convention
```
feat: Add metric detail screen with charts
fix: Resolve token refresh race condition
docs: Update API documentation
style: Format code with prettier
refactor: Extract chart component
test: Add unit tests for auth
chore: Update dependencies
```

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests pass
- [ ] Manual testing done
- [ ] Tested on iOS
- [ ] Tested on Android

## Screenshots
(if applicable)
```

## Code Style

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting

```bash
# Lint
yarn lint

# Format
yarn format
```

### Python
- Follow PEP 8
- Use Black for formatting
- Use Ruff for linting

```bash
# Lint
ruff check .

# Format
black .
```

## Adding New Features

### New API Endpoint

1. **Define the route in `server.py`**
```python
@api.get("/api/new-feature")
async def new_feature(user=Depends(current_user)):
    # Implementation
    return {"data": result}
```

2. **Add to API client**
```typescript
// src/api/client.ts
newFeature: () => request<NewFeatureResponse>('/new-feature'),
```

3. **Use in component**
```tsx
const data = await api.newFeature();
```

### New Screen

1. **Create the screen file**
```
frontend/app/new-screen.tsx
```

2. **Basic structure**
```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import AuroraBackground from '@/src/components/AuroraBackground';

export default function NewScreen() {
  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppText>New Screen</AppText>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
```

3. **Navigate to it**
```tsx
router.push('/new-screen');
```

### New Component

1. **Create in `src/components/`**
```tsx
// src/components/NewComponent.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  title: string;
  onPress?: () => void;
}

export default function NewComponent({ title, onPress }: Props) {
  return (
    <View style={styles.container}>
      {/* Implementation */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
});
```

2. **Export from index (if using barrel exports)**
```typescript
export { default as NewComponent } from './NewComponent';
```

## Environment Configuration

### Backend (.env)
```env
# Database
MONGO_URL=mongodb://localhost:27017/healthbridge

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI
EMERGENT_LLM_KEY=sk-emergent-...

# Push Notifications (optional)
EXPO_ACCESS_TOKEN=...
```

### Frontend (.env)
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

## Debugging

### Backend Logs
```bash
# View live logs
tail -f /var/log/supervisor/backend.err.log

# Or with uvicorn
uvicorn server:api --reload --log-level debug
```

### Frontend Logs
```bash
# Metro bundler logs
yarn start

# Device logs (React Native)
npx react-native log-ios
npx react-native log-android
```

### API Testing
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@healthbridge.app","password":"ySk4rWp4nSn5KsB8WvI4iF"}' \
  | jq -r '.access_token')

# Use token
curl http://localhost:8001/api/metrics/summary \
  -H "Authorization: Bearer $TOKEN"
```

## Deployment

### EAS Build (Expo)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for development
eas build --profile development --platform all

# Build for production
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Backend Deployment
```bash
# Docker build
docker build -t healthbridge-api .

# Run container
docker run -p 8001:8001 --env-file .env healthbridge-api
```

## Troubleshooting

### Common Issues

**Metro bundler stuck**
```bash
yarn start --clear
# or
rm -rf node_modules/.cache
```

**Pod install issues (iOS)**
```bash
cd ios && pod install --repo-update && cd ..
```

**MongoDB connection failed**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**JWT token expired**
- Token auto-refreshes in AuthContext
- If issues persist, logout and login again

**TypeScript errors**
```bash
# Reset TypeScript cache
rm -rf node_modules/.cache/typescript
yarn tsc --noEmit
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [Stripe API Reference](https://stripe.com/docs/api)
