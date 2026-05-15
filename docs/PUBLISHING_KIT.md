# App Store & Play Store Publishing Kit

## Listing copy (use as-is, both stores)

**App name**: HealthBridge Vault

**Subtitle (30 chars)**: One vault. Every ecosystem.

**Short description (Play Store, 80 chars)**:
Use Apple Watch with Android — and Galaxy Watch with iPhone. End-to-end encrypted.

**Long description**:
> HealthBridge Vault is the long-missing bridge between Apple Health, Samsung Health and Google Fit. Wear an Apple Watch on Android. Wear a Galaxy Watch on iPhone. Stop losing your data to ecosystem walls.
>
> • Bidirectional, near-real-time sync of steps, heart rate, sleep, blood oxygen, ECG, workouts and activity rings.
> • Connect any watch — Apple Watch Series 1+ and any Galaxy Watch with Wear OS / Tizen.
> • Unified dashboard that merges both ecosystems into one beautiful view.
> • Per-metric toggles · conflict-resolution policy · live audit log.
> • Privacy Vault — biometric-gated, end-to-end encrypted, zero-knowledge: we cannot read your health data.
> • Manual export to CSV, JSON or GPX. Your data, always portable.
> • Apple Health, Health Connect and Samsung Health permissions are managed transparently.
>
> HealthBridge PRO ($4.99/mo) unlocks multi-watch bridging, raw archive export and priority support.

**Keywords (App Store, 100 chars)**:
`apple watch,android,galaxy watch,iphone,health,sync,healthkit,samsung health,google fit,fitness,bridge`

**Promotional text (App Store, 170 chars)**:
> The bridge between Apple, Samsung and Google. End-to-end encrypted, biometric-locked, zero-knowledge.

**Support URL**: https://healthbridge.app/support
**Marketing URL**: https://healthbridge.app
**Privacy Policy URL**: https://healthbridge.app/privacy

## App Store screenshots (6.7", 6.5" required)
Capture the following screens via the production build (iPhone 15 Pro Max simulator → ⌘S):
1. **Onboarding** — hero with "One vault. Every ecosystem." headline
2. **Dashboard** — unified rings + metric cards (both ecosystems visible)
3. **Watches** — Apple Watch + Galaxy Watch cards both Connected
4. **Sync** — per-metric switches + conflict policy
5. **Vault** — locked state with biometric prompt
6. **Settings → PRO** — the subscribe card with $4.99/mo

## Google Play screenshots (Pixel 7 Pro emulator)
Same six shots above plus a Tablet 7" portrait set (use Pixel Tablet emulator).

## App Privacy (App Store) / Data Safety (Play Store)
See `/app/docs/DATA_SAFETY.md`.

## Categories
- Apple App Store primary: **Health & Fitness** · secondary: **Medical**
- Google Play primary: **Health & Fitness**

## Age rating
- IARC: 4+ (no objectionable content)
- Apple: 4+

## Required documents
| File | Purpose |
|---|---|
| `/app/docs/PRIVACY_POLICY.md` | Public privacy policy (host as HTML on healthbridge.app/privacy) |
| `/app/docs/TERMS.md` | Public terms (healthbridge.app/terms) |
| `/app/docs/DATA_SAFETY.md` | Copy-paste answers for both stores' questionnaires |
| `/app/docs/NATIVE_BRIDGE.md` | Required for Apple HealthKit review — explains your use of HK |

## Apple HealthKit review checklist
- ✅ App description explicitly mentions HealthKit usage.
- ✅ `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` are user-benefit-first (configured).
- ✅ No HealthKit data sold or used for advertising (compliance statement in DATA_SAFETY.md).
- ✅ HealthKit data is **not** stored on a server without explicit consent (we sync to MongoDB only with the user's consent and offer the Privacy Vault).
- ✅ HealthKit data is **not** used to authenticate accounts.

## Play Store Health Connect requirements
- Declare the `health.READ_*` / `health.WRITE_*` permissions you use (already configured).
- Submit the **Health Connect Permissions Declaration Form** in Play Console → Policy.
- App must be classified as Medical OR Health & Fitness.

## Pricing
- Free tier (forever): single-watch bridge, basic dashboard, manual export of last 30 days.
- HealthBridge PRO: $4.99/mo or $49.99/yr — multi-watch, unlimited export, priority support.

## Release notes template
> v1.0.0 — Initial release
> • Apple Watch ⇄ Android & Galaxy Watch ⇄ iPhone bridge.
> • Unified dashboard, per-metric toggles, biometric Privacy Vault.
> • Manual export (CSV/JSON/GPX).
