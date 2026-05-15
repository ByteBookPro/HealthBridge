# Privacy Policy

_Last updated: 15 May 2026_

HealthBridge Vault ("we", "us", "the app") is operated by HealthBridge Labs.
We have built this product around a simple promise: **your health data is yours and only yours**. This Privacy Policy describes what we collect, how we handle it, and the rights you have.

## 1. Information we collect

**Account information** — email, optional display name and a bcrypt-hashed password.

**Health & wellness data** — steps, heart rate, sleep, blood oxygen, ECG, workouts, calories and stand hours. **Only the metrics you explicitly enable** sync to the app's encrypted vault.

**Connected watches** — model, battery and last-sync timestamp.

**Subscription information** — if you upgrade to PRO, Stripe receives your payment details. We store the Stripe customer ID, current plan, period end and cancel-at-period-end flag. We never see or store your card number.

**Push tokens** — when you allow notifications, we store your Expo push token to deliver alerts.

**Device** — platform (iOS / Android), app version, OS version.

We **do not** collect: precise location, contacts, photos, microphone, advertising identifiers.

## 2. How we use it
- To run the cross-ecosystem bridge (the entire point of the app).
- To resolve conflicts between Apple Health and Samsung/Google data.
- To deliver push notifications you have opted into.
- To process subscription payments via Stripe.
- To respond to support requests you initiate.

## 3. How we **don't** use it
- We **never sell** your data.
- We **never share** it with advertisers, brokers or analytics services.
- We **never use HealthKit data** for non-health functionality.
- We **never read** the encrypted contents of your Privacy Vault.

## 4. Encryption & security
- TLS 1.3 in transit.
- AES-256 at rest on encrypted database volumes.
- JWT tokens stored on the device's secure enclave (iOS Keychain / Android Keystore).
- Biometric gate on the Privacy Vault before any raw-data view or export.
- Independent audit log of every sync operation (visible to you in-app).

## 5. Your rights
- **Access** — Settings → Data & Privacy → Export Vault (JSON / CSV / GPX).
- **Deletion** — Settings → Sign Out → Delete Account, or write to `privacy@healthbridge.app`.
- **Portability** — your full archive is exportable at any time in machine-readable formats.
- **Opt-out** — per-metric sync toggles + global background-sync switch.

## 6. Sub-processors
| Vendor | Purpose | Data |
|---|---|---|
| Stripe | Billing | Email, name, payment metadata |
| Expo (push) | Notifications | Push token only |
| MongoDB Atlas | DB hosting | Encrypted application data |

## 7. Children
HealthBridge is not directed at users under 13. We do not knowingly collect data from children.

## 8. Changes
We will notify you in-app and by email before any change that materially expands the scope of data we collect.

## 9. Contact
**HealthBridge Labs**, privacy@healthbridge.app
EU Representative: Hera Compliance s.r.o., Prague, CZ
California residents: dataprotection-ca@healthbridge.app
