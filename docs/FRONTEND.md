# HealthBridge Vault - Frontend Guide

## Project Structure

```
frontend/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab navigation group
│   │   ├── _layout.tsx          # Tab bar configuration
│   │   ├── index.tsx            # Dashboard (home)
│   │   ├── watches.tsx          # Connected watches
│   │   ├── sync.tsx             # Sync history
│   │   ├── insights.tsx         # AI insights (PRO)
│   │   └── profile.tsx          # User profile
│   ├── metric/
│   │   └── [type].tsx           # Dynamic metric detail
│   ├── _layout.tsx              # Root layout
│   ├── index.tsx                # Entry redirect
│   ├── login.tsx                # Login screen
│   ├── register.tsx             # Registration screen
│   ├── onboarding.tsx           # First-time setup
│   ├── setup.tsx                # Universal watch setup
│   ├── connect.tsx              # Bridge setup guide
│   ├── notifications.tsx        # Notification settings
│   └── admin.tsx                # Admin dashboard
├── src/
│   ├── api/
│   │   └── client.ts            # API client with all endpoints
│   ├── components/
│   │   ├── AppText.tsx          # Typography component
│   │   ├── GlassCard.tsx        # Glassmorphic card
│   │   ├── PrimaryButton.tsx    # Main CTA button
│   │   ├── MetricCard.tsx       # Metric display card
│   │   ├── ActivityRings.tsx    # Apple-style rings
│   │   ├── Sparkline.tsx        # Mini chart
│   │   └── AuroraBackground.tsx # Animated background
│   ├── context/
│   │   └── AuthContext.tsx      # Authentication state
│   ├── services/
│   │   ├── healthBridge.ts      # Native health integration
│   │   ├── notificationBridge.ts# Push notifications
│   │   └── pushNotifications.ts # Expo notifications
│   ├── theme/
│   │   └── theme.ts             # Design tokens
│   └── utils/
│       └── storage.ts           # SecureStore helpers
├── assets/                       # Images, fonts
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
└── tsconfig.json                # TypeScript config
```

## Design System

### Colors (Dark Theme)
```typescript
const colors = {
  bg: '#0A0A0F',           // Background
  surface: '#12121A',       // Card background
  glass: 'rgba(255,255,255,0.04)', // Glassmorphic
  border: 'rgba(255,255,255,0.08)',
  text: '#F8FAFC',          // Primary text
  textDim: '#94A3B8',       // Secondary text
  textMute: '#64748B',      // Muted text
  teal: '#2DD4BF',          // Primary accent
  emerald: '#10B981',       // Success
  danger: '#EF4444',        // Error
  apple: '#F3F4F6',         // Apple brand
  samsung: '#3B82F6',       // Samsung brand
};
```

### Typography
```typescript
const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// Usage with AppText
<AppText weight="heading" size={24}>Title</AppText>
<AppText weight="semi" size={14}>Subtitle</AppText>
<AppText size={12} color={theme.colors.textDim}>Body</AppText>
```

### Spacing (8pt Grid)
```typescript
const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

## Key Components

### GlassCard
Glassmorphic card with optional glow effect.

```tsx
import GlassCard from '@/src/components/GlassCard';

<GlassCard style={{ padding: 16 }} glow>
  <AppText>Content</AppText>
</GlassCard>
```

### MetricCard
Displays a health metric with sparkline chart.

```tsx
import MetricCard from '@/src/components/MetricCard';

<MetricCard 
  m={{
    metric: 'steps',
    label: 'Steps',
    current: 12500,
    goal: 10000,
    unit: 'steps',
    trend: [11200, 10800, 12500],
    delta_pct: 8.5,
    apple_value: 6500,
    samsung_value: 6000
  }}
/>
```

### ActivityRings
Apple-style concentric activity rings.

```tsx
import ActivityRings from '@/src/components/ActivityRings';

<ActivityRings 
  size={170}
  thickness={14}
  rings={[
    { progress: 0.85, colorFrom: '#F97316', colorTo: '#EF4444' },
    { progress: 0.65, colorFrom: '#10B981', colorTo: '#2DD4BF' },
    { progress: 0.75, colorFrom: '#3B82F6', colorTo: '#8B5CF6' },
  ]}
/>
```

### PrimaryButton
Main call-to-action button with gradient and loading state.

```tsx
import PrimaryButton from '@/src/components/PrimaryButton';

<PrimaryButton
  title="Continue"
  onPress={handlePress}
  loading={isLoading}
  disabled={!isValid}
  icon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
/>
```

## State Management

### Authentication Context
```tsx
import { useAuth } from '@/src/context/AuthContext';

function MyComponent() {
  const { user, token, login, logout, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Redirect href="/login" />;
  
  return <Dashboard user={user} />;
}
```

### API Client Usage
```tsx
import { api } from '@/src/api/client';

// Fetch metrics
const metrics = await api.metrics();

// Get metric detail
const detail = await api.metricDetail('steps', 'week');

// Trigger sync
await api.syncNow();

// Login
const tokens = await api.login(email, password);
```

## Navigation

### Tab Navigation
Configured in `app/(tabs)/_layout.tsx`:
- Dashboard (home icon)
- Watches (watch icon)
- Sync (sync icon)
- Insights (sparkles icon) - PRO badge
- Profile (person icon)

### Stack Navigation
All non-tab screens are stack-navigated:
```tsx
import { useRouter } from 'expo-router';

const router = useRouter();

// Navigate
router.push('/metric/steps');
router.push('/setup');

// Replace (no back)
router.replace('/(tabs)');

// Go back
router.back();
```

## Native Health Integration

### HealthBridge Service
```tsx
import { HealthBridge } from '@/src/services/healthBridge';

// Check availability
const available = HealthBridge.available();

// Request permissions
const granted = await HealthBridge.requestPermissions();

// Pull and sync data
const synced = await HealthBridge.syncToCloud();

// Write to opposite ecosystem
await HealthBridge.writeToOppositeEcosystem(sample);
```

**Note**: Full native functionality requires EAS dev build. Expo Go uses simulated data.

## Animations

Using `react-native-reanimated`:

```tsx
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

<Animated.View entering={FadeInDown.duration(400)}>
  <GlassCard>...</GlassCard>
</Animated.View>

<Animated.View entering={FadeInRight.delay(100).duration(300)}>
  <MetricCard m={metric} />
</Animated.View>
```

## Charts with SVG

Using `react-native-svg`:

```tsx
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

// Line chart example
<Svg width={width} height={height}>
  <Defs>
    <LinearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
      <Stop offset="0" stopColor="#2DD4BF" />
      <Stop offset="1" stopColor="#10B981" />
    </LinearGradient>
  </Defs>
  <Path d={pathD} stroke="url(#gradient)" strokeWidth={2.5} fill="none" />
  {points.map((p, i) => (
    <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#2DD4BF" />
  ))}
</Svg>
```

## Platform-Specific Code

```tsx
import { Platform } from 'react-native';

// Conditional rendering
{Platform.OS === 'ios' && <AppleHealthButton />}
{Platform.OS === 'android' && <HealthConnectButton />}

// Platform-specific styles
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 0 : 24,
  },
});

// Platform.select
const icon = Platform.select({
  ios: 'logo-apple',
  android: 'logo-android',
  default: 'globe',
});
```

## Testing

### Unit Tests
```bash
yarn test
```

### E2E Tests (Detox)
```bash
yarn e2e:build
yarn e2e:test
```

### Manual Testing
1. Web preview: `yarn web`
2. Expo Go: Scan QR code
3. Dev build: `eas build --profile development`
