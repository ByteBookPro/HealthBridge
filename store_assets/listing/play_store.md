# Google Play Console — Listing Copy

_Paste these into Play Console → Main store listing._

## Store Listing

| Field | Value |
|---|---|
| **App name** (30 chars) | HealthBridge Vault |
| **Short description** (80 chars) | Cross-brand watch sync. AI insights. Encrypted vault. Your data, forever. |
| **Application ID** | app.healthbridge.vault |
| **Default language** | English (United States) |
| **App category** | Health & Fitness |
| **Tags** (up to 5) | Health, Fitness, Wearables, Activity tracker, Sleep tracker |
| **Contact email** | hello@healthbridge.app |
| **Privacy policy URL** | https://healthbridge.app/privacy |

## Full description (4000 chars)

HealthBridge Vault is the only health platform built for the multi-watch era. Switch watches without losing a single step.

Whether you're moving from a Galaxy Watch to a Pixel Watch, alternating a Garmin for trail runs and a Fitbit for sleep, or simply want a vendor-free home for a lifetime of metrics, HealthBridge keeps every step, heartbeat, and sleep cycle in one encrypted, AI-aware place.

✨ WHAT MAKES IT DIFFERENT

• Cross-brand sync — Apple Watch, Samsung Galaxy Watch, Garmin, Fitbit, Polar, Whoop, Oura
• Watch migration wizard — switching brands? Carry every metric across in minutes
• AI Health Insights (PRO) — GPT-powered analysis spots patterns you'd miss
• Encrypted vault — biometric lock + AES export, your data never leaves you
• Smart notification bridge — per-app allow-lists and quiet hours
• Goal tracking + weekly reports (PRO)
• One-tap export to JSON, CSV, GPX

🔓 FREE vs PRO

Free: Cross-brand sync, dashboard, notification bridge, migration, JSON/CSV export.
PRO ($4.99/mo, 30-day free trial): AI Insights, Goals + Weekly Report, GPX export, advanced conflict resolution, unlimited history.

🔒 PRIVACY FIRST

We don't sell your data. We don't share it with advertisers. End-to-end TLS, locally biometric-gated, exportable or deletable at any time.

Made by humans who got tired of starting from zero every time they switched watches.

Questions? Email hello@healthbridge.app

## What's new (500 chars)

Welcome to HealthBridge Vault 1.0! Cross-brand sync, AI insights (PRO), watch migration, encrypted vault, notification bridge, goals + weekly reports. One tap export to JSON, CSV, GPX.

## Pricing & Distribution

- Pricing: Free, with in-app subscription (HealthBridge PRO $4.99/mo)
- Countries: All
- Contains ads: **No**
- In-app purchases: **Yes** ($4.99 — subscription)
- Target age: 13+

## Subscription product

| Product ID | Display Name | Billing period | Price | Free trial |
|---|---|---|---|---|
| `hbv_pro_monthly` | HealthBridge PRO | Monthly | $4.99 | 30 days |

Add as **base plan** under product `hbv_pro_monthly` with auto-renewing monthly billing and 30-day free trial offer.

## App access (Play Console)

We have a login-gated app. Provide reviewer credentials:

```
email: admin@healthbridge.app
password: ySk4rWp4nSn5KsB8WvI4iF
instructions:
- Open app and tap "Sign in".
- Use the credentials above. This is a PRO account so reviewers
  can validate AI Insights, Goals, and Weekly Report.
- Biometric unlock on the Vault tab can be skipped via the
  "Skip for now" button.
```

## App content questionnaire — quick answers

- **Target audience**: 13+ (no children-specific content)
- **Ads**: None
- **In-app purchases**: Yes, $4.99 monthly subscription
- **Data safety**: See `/app/store_assets/compliance/play_store_data_safety.md`
- **News app**: No
- **COVID-19 contact tracing or status app**: No
- **Government app**: No
- **Health Connect access**: Yes — reads/writes Steps, Heart Rate, Sleep, Exercise, Oxygen Saturation. **Required justification** field: "To bridge health metrics across users' Wear OS / Galaxy / partner watches so that switching devices does not lose history. Data is stored only in the user's vault and is never sold or shared."
