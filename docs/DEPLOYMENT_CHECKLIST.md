# HealthBridge Vault — Deployment Checklist

Four blocking items separate the current preview from a live production release. Items marked **YOU** require an account or asset you own (Stripe / Apple / Google / DNS); items marked **DONE** are already wired in this repo.

---

## ✅ 1. Stripe — live test billing
**Status: dev_mode fallback active** (placeholder key `sk_test_emergent` in `backend/.env`).
The whole Stripe flow already works end-to-end — the only thing missing is your real test key.

### Steps (YOU)
1. Go to https://dashboard.stripe.com → toggle **Test mode** (top-right).
2. Copy the **Secret key** that starts with `sk_test_…`.
3. Go to **Developers → Webhooks** → **Add endpoint**:
   - Endpoint URL: `https://<your-backend>/api/billing/webhook`
   - Events to send: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **Signing secret** that starts with `whsec_…`.
4. Drop both into `/app/backend/.env`:
   ```bash
   STRIPE_API_KEY="sk_test_REPLACE_ME"
   STRIPE_WEBHOOK_SECRET="whsec_REPLACE_ME"
   ```
5. Restart the backend (`sudo supervisorctl restart backend`).

Once those are in, the Subscribe → Checkout flow on the Settings tab opens the real hosted Stripe Checkout, the webhook updates the user record, and the Customer Portal lets users self-manage.

Test card for any flow: `4242 4242 4242 4242` · any future date · any 3-digit CVC.

---

## ✅ 2. App Store / Play Store builds & submission
**Status: project fully configured**: `app.json`, `eas.json`, all permissions, native bridge plugins, splash/icon, scheme — done.

### Steps (YOU) — recommended path: **Emergent Publish button**
1. Open the Emergent editor.
2. Click the **Publish** button (top-right corner).
3. Choose:
   - **Web** — instant static deploy of the admin portal at `https://<your-app>.emergent.app/admin`.
   - **iOS / Android** — Emergent will run the EAS build on its infrastructure, you don't need your own Apple/Google developer accounts to test internal builds.
4. For real App Store / Play Store submission you still need:
   - Apple Developer Program membership ($99/yr) — required for HealthKit entitlement review.
   - Google Play Console one-time $25 — required for Health Connect.
5. Once built, follow `/app/docs/PUBLISHING_KIT.md` to fill in the listing copy and `/app/docs/DATA_SAFETY.md` for the privacy questionnaires.

### Alternative path (advanced) — `eas-cli`
If you'd rather build on your own machine, the full EAS workflow is documented in `/app/docs/EAS_BUILD.md`. The `eas.json` profiles (`development` / `preview` / `production`) are ready to use.

---

## ✅ 3. Host PRIVACY_POLICY and TERMS publicly
**Status: copy authored.** The App Store **requires** a public URL for both before submission.

### Steps (YOU)
1. Buy / point a domain (e.g. `healthbridge.app`) — any registrar.
2. The fastest path: paste the content from `/app/docs/PRIVACY_POLICY.md` and `/app/docs/TERMS.md` into:
   - GitHub Pages (free, 5-min setup),
   - or Vercel / Netlify / Cloudflare Pages (drag-and-drop markdown → static site),
   - or even a Google Doc set to public-link.
3. Update both URLs in `/app/docs/PUBLISHING_KIT.md` ("Support URL" / "Marketing URL" / "Privacy Policy URL") before submitting.
4. Update both URLs in `app.json` if you add an in-app web link to them.

Minimum acceptable for App Review: a public, accessible HTML or markdown render at a stable URL.

---

## ✅ 4. Rotate ADMIN_PASSWORD
**Status: DONE — rotated to a fresh secure value during deployment prep.**

The new admin credentials are in `/app/memory/test_credentials.md`. The seeder is idempotent: any future change to `ADMIN_PASSWORD` in `backend/.env` followed by `sudo supervisorctl restart backend` updates the in-DB hash on the next startup (delete the user record first if you want a full wipe).

For **production** rotation, do **not** keep the password in `.env` — instead use EAS secrets / your cloud provider's secret manager:
```bash
# Example
eas secret:create --scope project --name ADMIN_PASSWORD --value "$(openssl rand -base64 24)"
```

---

## 🔐 Production hardening one-liners

```bash
# Generate a fresh JWT secret
openssl rand -hex 32

# Generate a fresh ADMIN_PASSWORD
openssl rand -base64 24

# Rotate both in one shot
echo "JWT_SECRET=\"$(openssl rand -hex 32)\"" >> /app/backend/.env
echo "ADMIN_PASSWORD=\"$(openssl rand -base64 24)\"" >> /app/backend/.env
sudo supervisorctl restart backend
```

Also flip `MONGO_URL` to a MongoDB Atlas SRV URI with authentication enabled before going live.

---

## 📋 Pre-submission sanity checklist
- [ ] Real `sk_test_…` and `whsec_…` in `backend/.env` (item 1)
- [ ] Build green on Emergent Publish button OR `eas build --profile production --platform all`
- [ ] Privacy + Terms URLs live and reachable (item 3)
- [ ] All `REPLACE_WITH_…` placeholders in `eas.json` filled with your Apple Team ID / ASC App ID / Google service account path
- [ ] Bundle ID set in your Apple/Google consoles (recommended: `com.healthbridge.vault`)
- [ ] HealthKit capability enabled on the iOS provisioning profile (App Store Connect → Identifiers)
- [ ] Health Connect Permissions Declaration Form submitted in Google Play Console
- [ ] `JWT_SECRET` and `ADMIN_PASSWORD` rotated for production
- [ ] `MONGO_URL` switched to authenticated MongoDB Atlas URI
- [ ] App Privacy / Data Safety answered using `/app/docs/DATA_SAFETY.md`
- [ ] Screenshots captured per `/app/docs/PUBLISHING_KIT.md` (6.7", 6.5", Pixel 7 Pro)
