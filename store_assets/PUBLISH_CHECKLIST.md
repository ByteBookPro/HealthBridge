# HealthBridge Vault — Publish Checklist

This is the single source of truth for getting v1.0.0 onto the App Store and Play Store.

## 1. Code & config (✅ done in this session)

- [x] Backend syntax error fixed
- [x] `app.json` has `ios.bundleIdentifier=app.healthbridge.vault`, `android.package=app.healthbridge.vault`, `version=1.0.0`, `buildNumber=1`, `versionCode=1`, `slug=healthbridge-vault`, `ITSAppUsesNonExemptEncryption=false`
- [x] All iOS usage strings (`NSFaceIDUsageDescription`, `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`, `NSBluetoothAlways/PeripheralUsageDescription`, `NSUserNotificationsUsageDescription`) present
- [x] All Android permissions (Health Connect read/write, BIOMETRIC, POST_NOTIFICATIONS, BODY_SENSORS) declared
- [x] Icons regenerated: `icon.png` is 1024×1024 RGB (no alpha) for App Store; `adaptive-icon.png` is 1024×1024 RGBA with 66% safe-zone for Play Store; `splash-icon.png` 400×400 (created — was missing!); `play-store-icon.png` 512×512 for Play listing
- [x] Backend tests 56/56 ✅
- [x] Frontend QA 17/17 flows, 14/14 screens ✅
- [x] Admin `/api/admin/billing/health` endpoint added to verify Stripe live-key swap after deploy

## 2. Assets ready for upload

- [x] App icons (in `frontend/assets/images/`)
- [x] Store screenshots (in `store_assets/screenshots/iphone_6_7/` and `store_assets/screenshots/android_phone/`)
- [x] Listing copy: `store_assets/listing/app_store.md` and `store_assets/listing/play_store.md`
- [x] Privacy nutrition label: `store_assets/compliance/app_store_privacy_labels.md`
- [x] Data safety form: `store_assets/compliance/play_store_data_safety.md`

## 3. What YOU need to do before publish

### Apple
1. Create app record in **App Store Connect** with bundle ID `app.healthbridge.vault`.
2. Paste copy from `store_assets/listing/app_store.md`.
3. Upload screenshots from `store_assets/screenshots/iphone_6_7/`.
4. Fill privacy nutrition label using `store_assets/compliance/app_store_privacy_labels.md`.
5. Create the auto-renewable subscription product `hbv.pro.monthly` ($4.99/mo, 30-day free trial).
6. Provide reviewer notes + demo account (`admin@healthbridge.app` / `ySk4rWp4nSn5KsB8WvI4iF`).

### Google
1. Create app in **Play Console** with package `app.healthbridge.vault`.
2. Paste copy from `store_assets/listing/play_store.md`.
3. Upload screenshots from `store_assets/screenshots/android_phone/`.
4. Fill Data Safety form using `store_assets/compliance/play_store_data_safety.md`.
5. Declare Health Connect access with the exact rationale string in the form.
6. Create subscription `hbv_pro_monthly` ($4.99/mo, 30-day free trial).

### Stripe (after first production deploy)

1. In your deployed Emergent environment variables (NOT in `.env` committed to git), replace `STRIPE_API_KEY` with your `sk_live_...` key.
2. Set `STRIPE_WEBHOOK_SECRET` to the real `whsec_...` from Stripe Dashboard → Webhooks (point at `<your-prod-url>/api/billing/webhook`).
3. Restart backend. Then hit `GET /api/admin/billing/health` with the admin token — you should see:
   ```json
   {
     "stripe_key_mode": "live",
     "webhook_secret_configured": true,
     "stripe_reachable": true
   }
   ```
4. If `stripe_reachable=false`, check the `stripe_error` field for the API’s response.

## 4. Build & submit (Emergent path)

Click the **Publish** button at the top-right of the Emergent chat. That triggers the EAS build & store submission flow. Per Emergent support, you may also need to:

- Save to GitHub (top of Emergent chat) and run `eas build` / `eas submit` locally with the credentials in `eas.json`.
- For local builds, fill in `eas.json → submit → production`: Apple ID, ASC App ID, Apple Team ID, Google service-account JSON path.
