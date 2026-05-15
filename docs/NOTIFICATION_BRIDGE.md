# Notification Bridge — Forwarding phone notifications to a paired Galaxy Watch

## What this does
Forwards incoming notifications (SMS / iMessage / WhatsApp / Calls / Calendar / Email) from the **phone** to a paired **Galaxy Watch** over standard Bluetooth Low Energy.

This works on:
| Phone | Watch | Path |
|---|---|---|
| iPhone | Galaxy Watch | Galaxy Watch advertises the standard ANS (Alert Notification Service, UUID `0x1811`). iOS connects as a central via `react-native-ble-plx` and writes notifications to the watch's ANS characteristic. |
| Android | Galaxy Watch | A Notification Listener Service (`react-native-android-notification-listener`) reads OS notifications and re-emits them onto the Health Connect / Samsung Wearable channel. |

## What this does **NOT** do
- **Cannot** forward Android notifications to an Apple Watch — WatchOS requires an iPhone and ignores BLE notifications from any other device. This is an Apple platform restriction; there is no workaround.
- **Cannot** make Galaxy Watch behave as a fully-featured Apple Watch on iPhone — Bixby, contactless pay, third-party watch apps and rich watch faces don't work in iOS-paired mode.

## Permissions required (already in `app.json`)
### iOS
- `NSBluetoothAlwaysUsageDescription` — already set.
- Background mode `bluetooth-central` and `bluetooth-peripheral` — added to EAS build profile.

### Android
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` — already declared.
- **Notification access** (special user-granted permission): The user must grant it in OS Settings → Apps → Special access → Notification access. The app prompts via `NotificationBridge.ensureAndroidAccess()` on first use.

## How to install the native dependencies (EAS dev build only)
```bash
cd /app/frontend
yarn expo install react-native-ble-plx
yarn add react-native-android-notification-listener
```

Both are auto-loaded by `/app/frontend/src/services/notificationBridge.ts` via `require()` inside try/catch — Expo Go preview keeps working with the demo path (events are logged to the backend audit only).

## Architecture

```
                ┌─────────────────────────────────────┐
                │           iPhone (iOS)              │
                │                                     │
   incoming     │  ┌─────────────┐                    │
   notification─┼─▶│ APNs / app  │── observed by us   │
                │  └──────┬──────┘                    │
                │         ▼                           │
                │  NotificationBridge.forwardToWatch  │
                │         │                           │
                │         ▼ BLE GATT write (0x1811)   │
                │  ┌──────────────────┐               │
                │  │ react-native-    │               │
                │  │ ble-plx          │───── BLE ─────┼──▶ Galaxy Watch
                │  └──────────────────┘               │     (ANS consumer)
                └─────────────────────────────────────┘
```

## Audit trail
Every forwarded notification is also written to MongoDB via `POST /api/bridge/notifications/event` so the user can review the full history in the **Notification Bridge** screen.

## App-allow-list
The user picks which app categories to forward (Messages, WhatsApp, Calls, Calendar, Email, Social) from the Notification Bridge screen. The backend enforces this on `POST /bridge/notifications/event` — events for non-allowlisted apps are dropped server-side with `reason: app_not_allowed`.

## Apple App Store review notes
- iOS allows generic BLE peripherals to subscribe to ANCS (Apple Notification Center Service). Our app does the **opposite** — it acts as a notification source pushing into Galaxy Watch's ANS. This is permitted under the standard BLE policy as long as background usage is disclosed in `NSBluetoothAlwaysUsageDescription`. We disclose: *"Forward phone notifications to your paired Galaxy Watch."*
- Apple does NOT permit the app to read iCloud / Messages directly. We listen to the OS notification stream (UNUserNotificationCenter) — the user grants this on first launch.
