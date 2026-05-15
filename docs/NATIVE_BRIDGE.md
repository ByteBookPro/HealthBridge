# Native Bridge Setup (HealthKit · Health Connect · Samsung Health)

HealthBridge Vault ships with **complete JS bridge code** that works against:
- iOS: `react-native-health` (HealthKit)
- Android: `react-native-health-connect` (Health Connect)
- Android: Samsung Health is read via Health Connect (Samsung Health writes there starting Android 14)

The simulator preview uses backend-seeded data. To unlock real device data you need an **EAS dev build** — Expo Go cannot load these native modules.

---

## 1. Install the native modules

```bash
cd /app/frontend
yarn expo install react-native-health react-native-health-connect
```

## 2. Add config plugins to `app.json`

```jsonc
{
  "expo": {
    "plugins": [
      // ... existing plugins
      [
        "react-native-health",
        {
          "isClinicalDataEnabled": false,
          "healthSharePermission": "Read your Apple Health metrics to bridge to Android.",
          "healthUpdatePermission": "Write bridged data into Apple Health."
        }
      ],
      "react-native-health-connect"
    ]
  }
}
```

Permission descriptions and the Android `health.*` permissions are **already** declared in this project's `app.json` (see `expo.ios.infoPlist` and `expo.android.permissions`).

## 3. Run the EAS dev build

```bash
# one-time setup
npm i -g eas-cli
eas login
eas build:configure

# iOS dev client (requires Apple Developer account)
eas build --profile development --platform ios

# Android dev client (no developer account needed)
eas build --profile development --platform android
```

Once installed, open the dev client and load this project — the app will detect the native modules automatically and the simulated data falls away.

## 4. How the JS layer auto-switches

The hot path lives in `/app/frontend/src/services/healthBridge.ts`. It uses `require()` inside `try/catch` so the native modules are loaded only when present:

```ts
let healthKit: any = null;
let healthConnect: any = null;
try { healthKit = require('react-native-health'); } catch {}
try { healthConnect = require('react-native-health-connect'); } catch {}
```

In Expo Go these requires fail silently and `HealthBridge.available()` returns `false`. In the dev/production build they succeed and the bridge calls real HealthKit / Health Connect APIs.

## 5. Cross-ecosystem write

After the user grants both read and write permissions, calling
`HealthBridge.writeToOppositeEcosystem(sample)` writes:
- on iOS: data from Samsung/Google into **Apple Health**
- on Android: data from Apple into **Health Connect** (Samsung Health & Google Fit subscribe to Health Connect)

This is the actual "bridge" — Apple-on-Android and Galaxy-on-iPhone.

## 6. Background sync

Use `expo-background-fetch` (already compatible) to schedule
`HealthBridge.syncToCloud()` every 15 minutes. iOS Background Tasks and
Android WorkManager are both managed by Expo's background fetch under the hood.

## 7. Samsung Health Partner Program

To call the Samsung Health SDK directly (rather than via Health Connect), apply for the
**Samsung Health Partner Program**: https://developer.samsung.com/health  →
SDK approval can take 4–8 weeks. **Health Connect is the recommended path** in 2026 because Samsung Health now writes through it natively.
