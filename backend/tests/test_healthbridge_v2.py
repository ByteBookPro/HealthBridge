"""HealthBridge Vault v2 backend integration tests.

Covers password reset, profile patch, change password, push register,
metrics/ingest, Stripe checkout dev-fallback, billing portal,
and admin endpoints (stats, users, plan toggle, cancel, broadcast, audit).
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break

API = f"{BASE_URL.rstrip('/')}/api"
DEMO_EMAIL = "demo@healthbridge.app"
DEMO_PASS = "Demo1234!"
ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASS = "Admin1234!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login_or_register(s, email, pw, name=None):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    if r.status_code == 401:
        r = s.post(f"{API}/auth/register",
                   json={"email": email, "password": pw, "name": name or email.split("@")[0]},
                   timeout=20)
    assert r.status_code in (200, 201), f"auth failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def demo_tokens(s):
    return _login_or_register(s, DEMO_EMAIL, DEMO_PASS, "Demo")


@pytest.fixture(scope="session")
def admin_tokens(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture
def demo_auth(demo_tokens):
    return {"Authorization": f"Bearer {demo_tokens['access_token']}"}


@pytest.fixture
def admin_auth(admin_tokens):
    return {"Authorization": f"Bearer {admin_tokens['access_token']}"}


# ---------- Password reset flow ----------
class TestPasswordReset:
    def test_forgot_returns_dev_token(self, s):
        r = s.post(f"{API}/auth/password/forgot", json={"email": DEMO_EMAIL})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "reset_token_dev_only" in body
        assert isinstance(body["reset_token_dev_only"], str)

    def test_forgot_unknown_email_returns_ok(self, s):
        r = s.post(f"{API}/auth/password/forgot", json={"email": f"no_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200
        # security: no enumeration; reset_token only when user exists
        assert "reset_token_dev_only" not in r.json()

    def test_reset_with_token_changes_password(self, s):
        # Create a temp user
        email = f"reset_{uuid.uuid4().hex[:8]}@example.com"
        old_pw = "OldPass1234!"
        new_pw = "NewPass5678!"
        reg = s.post(f"{API}/auth/register", json={"email": email, "password": old_pw, "name": "R"})
        assert reg.status_code == 201
        # request reset token
        r = s.post(f"{API}/auth/password/forgot", json={"email": email})
        token = r.json()["reset_token_dev_only"]
        # consume
        r2 = s.post(f"{API}/auth/password/reset", json={"token": token, "new_password": new_pw})
        assert r2.status_code == 200
        # old password no longer works
        bad = s.post(f"{API}/auth/login", json={"email": email, "password": old_pw})
        assert bad.status_code == 401
        # new password works
        good = s.post(f"{API}/auth/login", json={"email": email, "password": new_pw})
        assert good.status_code == 200
        # token cannot be reused
        reuse = s.post(f"{API}/auth/password/reset", json={"token": token, "new_password": "Another1234!"})
        assert reuse.status_code == 400

    def test_reset_invalid_token(self, s):
        r = s.post(f"{API}/auth/password/reset", json={"token": "bogus-token", "new_password": "Another1234!"})
        assert r.status_code == 400


# ---------- Profile patch ----------
class TestProfilePatch:
    def test_patch_me_updates_name(self, s, demo_auth):
        new_name = f"Demo {uuid.uuid4().hex[:4]}"
        r = s.patch(f"{API}/auth/me", json={"name": new_name}, headers=demo_auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == new_name
        assert body["email"] == DEMO_EMAIL
        # GET verifies persistence
        me = s.get(f"{API}/auth/me", headers=demo_auth).json()
        assert me["name"] == new_name


# ---------- Change password ----------
class TestChangePassword:
    def test_change_password_wrong_current_400(self, s, demo_auth):
        r = s.post(f"{API}/auth/password/change",
                   json={"current_password": "WrongPass!", "new_password": "Whatever1234!"},
                   headers=demo_auth)
        assert r.status_code == 400

    def test_change_password_success_and_revert(self, s):
        # Use a temp user so we don't break the demo seed
        email = f"chg_{uuid.uuid4().hex[:8]}@example.com"
        pw1, pw2 = "First1234!", "Second5678!"
        reg = s.post(f"{API}/auth/register", json={"email": email, "password": pw1, "name": "C"})
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        r = s.post(f"{API}/auth/password/change",
                   json={"current_password": pw1, "new_password": pw2}, headers=h)
        assert r.status_code == 200
        # login with new pw works
        ok = s.post(f"{API}/auth/login", json={"email": email, "password": pw2})
        assert ok.status_code == 200


# ---------- Push register ----------
class TestPush:
    def test_register_push_token(self, s, demo_auth):
        tok = f"ExponentPushToken[TEST_{uuid.uuid4().hex[:12]}]"
        r = s.post(f"{API}/push/register",
                   json={"token": tok, "platform": "ios", "app_version": "2.0.0"},
                   headers=demo_auth)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # idempotent upsert: second call same token also OK
        r2 = s.post(f"{API}/push/register",
                    json={"token": tok, "platform": "ios"}, headers=demo_auth)
        assert r2.status_code == 200

    def test_register_push_requires_auth(self, s):
        r = s.post(f"{API}/push/register", json={"token": "x", "platform": "ios"})
        assert r.status_code == 401


# ---------- Metrics ingest ----------
class TestMetricsIngest:
    def test_ingest_updates_summary_and_events(self, s, demo_auth):
        before_events = s.get(f"{API}/sync/events?limit=200", headers=demo_auth).json()
        payload = {"samples": [
            {"metric": "steps", "value": 9123, "unit": "steps", "source": "apple"},
            {"metric": "heart_rate", "value": 68, "unit": "bpm", "source": "samsung"},
        ]}
        r = s.post(f"{API}/metrics/ingest", json=payload, headers=demo_auth)
        assert r.status_code == 200, r.text
        assert r.json()["ingested"] == 2
        # verify metric_summaries updated
        summary = s.get(f"{API}/metrics/summary", headers=demo_auth).json()
        steps = next(m for m in summary if m["metric"] == "steps")
        assert steps["current"] == 9123
        # events grew by >=2
        after_events = s.get(f"{API}/sync/events?limit=200", headers=demo_auth).json()
        assert len(after_events) >= len(before_events) + 2


# ---------- Billing checkout & portal (dev fallback) ----------
class TestBilling:
    def test_checkout_dev_fallback_upgrades_user(self, s):
        # Use a fresh free user so we can observe FREE → PRO transition
        email = f"bill_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": "Pass1234!", "name": "B"})
        assert reg.status_code == 201
        h = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        # pre-check
        me0 = s.get(f"{API}/auth/me", headers=h).json()
        assert me0["subscription"]["plan"] == "free"
        # checkout in dev mode
        r = s.post(f"{API}/billing/checkout",
                   json={"success_path": "/(tabs)/vault?checkout=success",
                         "cancel_path": "/(tabs)/vault?checkout=cancel"}, headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("demo") is True
        assert "url" in body
        # me reflects PRO + active
        me1 = s.get(f"{API}/auth/me", headers=h).json()
        assert me1["subscription"]["plan"] == "pro"
        assert me1["subscription"]["status"] == "active"
        assert me1["subscription"]["stripe_customer_id"] is not None
        # portal returns a URL
        rp = s.post(f"{API}/billing/portal", headers=h)
        assert rp.status_code == 200
        assert "url" in rp.json()

    def test_portal_without_customer_400(self, s):
        email = f"np_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": "Pass1234!"})
        h = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        r = s.post(f"{API}/billing/portal", headers=h)
        assert r.status_code == 400


# ---------- Admin endpoints ----------
class TestAdminGuards:
    def test_demo_user_forbidden_on_admin_stats(self, s, demo_auth):
        r = s.get(f"{API}/admin/stats", headers=demo_auth)
        assert r.status_code == 403

    def test_admin_can_access_stats(self, s, admin_auth):
        r = s.get(f"{API}/admin/stats", headers=admin_auth)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("total_users", "pro_users", "active_subscriptions",
                  "syncs_24h", "notifications_sent", "mrr_usd"):
            assert k in body
        assert body["total_users"] >= 2


class TestAdminUsers:
    def test_users_search_by_email(self, s, admin_auth):
        r = s.get(f"{API}/admin/users", params={"q": "demo@"}, headers=admin_auth)
        assert r.status_code == 200
        users = r.json()
        assert any(u["email"] == DEMO_EMAIL for u in users)
        # password must not leak
        for u in users:
            assert "password" not in u

    def test_users_list_default(self, s, admin_auth):
        r = s.get(f"{API}/admin/users", headers=admin_auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 2

    def test_set_plan_pro_then_free_and_cancel_immediate(self, s, admin_auth):
        # spawn a victim user
        email = f"ad_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": "Pass1234!"})
        uid = None
        # locate via admin search
        users = s.get(f"{API}/admin/users", params={"q": email}, headers=admin_auth).json()
        uid = next(u["id"] for u in users if u["email"] == email)
        # toggle to pro
        r1 = s.post(f"{API}/admin/users/{uid}/plan", params={"plan": "pro"}, headers=admin_auth)
        assert r1.status_code == 200
        # verify
        u = next(u for u in s.get(f"{API}/admin/users", params={"q": email}, headers=admin_auth).json()
                 if u["email"] == email)
        assert u["subscription"]["plan"] == "pro"
        assert u["subscription"]["status"] == "active"
        # toggle back to free
        r2 = s.post(f"{API}/admin/users/{uid}/plan", params={"plan": "free"}, headers=admin_auth)
        assert r2.status_code == 200
        u2 = next(u for u in s.get(f"{API}/admin/users", params={"q": email}, headers=admin_auth).json()
                  if u["email"] == email)
        assert u2["subscription"]["plan"] == "free"
        # immediate cancel
        r3 = s.post(f"{API}/admin/users/{uid}/cancel", params={"immediate": "true"}, headers=admin_auth)
        assert r3.status_code == 200
        u3 = next(u for u in s.get(f"{API}/admin/users", params={"q": email}, headers=admin_auth).json()
                  if u["email"] == email)
        assert u3["subscription"]["status"] == "canceled"

    def test_set_plan_invalid_400(self, s, admin_auth):
        # use admin's own id
        users = s.get(f"{API}/admin/users", params={"q": ADMIN_EMAIL}, headers=admin_auth).json()
        uid = next(u["id"] for u in users if u["email"] == ADMIN_EMAIL)
        r = s.post(f"{API}/admin/users/{uid}/plan", params={"plan": "platinum"}, headers=admin_auth)
        assert r.status_code == 400


class TestAdminBroadcastAudit:
    def test_broadcast(self, s, admin_auth):
        r = s.post(f"{API}/admin/broadcast",
                   json={"title": "TEST broadcast", "body": "Hello from pytest"},
                   headers=admin_auth)
        assert r.status_code == 200
        body = r.json()
        assert "recipients" in body and "sent" in body
        assert body["recipients"] >= 1

    def test_audit_returns_lists(self, s, admin_auth):
        r = s.get(f"{API}/admin/audit", headers=admin_auth)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body.get("sync_events"), list)
        assert isinstance(body.get("notifications"), list)
