"""
v8 — Admin console expansion test suite.

Covers:
- GET /api/admin/connectors/stats
- GET /api/admin/devices/stats
- GET /api/admin/engagement
- GET /api/admin/health
- GET /api/admin/users/{user_id}
- DELETE /api/admin/users/{admin_user_id}  (self-delete blocked → 400)
- DELETE /api/admin/users/{non_admin_user_id} → 200 + cascade cleanup
- 401 / 403 auth guards
- Light regression on prior endpoints
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://b5756d38-6d5c-4694-ae0a-e29e724ded9b.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASSWORD = "ySk4rWp4nSn5KsB8WvI4iF"

EXPECTED_CONNECTORS = {
    "apple_health", "google_fit", "samsung_health", "fitbit", "garmin",
    "myfitnesspal", "strava", "oura", "withings",
}


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in admin login response: {data}"
    return token


@pytest.fixture(scope="session")
def admin_id(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def fresh_user():
    """Create a fresh test user and return (token, user_id, email)."""
    email = f"TEST_v8_{uuid.uuid4().hex[:8]}@example.com"
    password = "Pass1234!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "v8 Test User"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in register response: {data}"
    # Fetch user_id via /auth/me
    me = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert me.status_code == 200
    user_id = me.json()["id"]
    return {"token": token, "user_id": user_id, "email": email, "password": password}


# ---------- Auth guard tests ----------

class TestAdminAuthGuards:
    ENDPOINTS = [
        "/api/admin/connectors/stats",
        "/api/admin/devices/stats",
        "/api/admin/engagement",
        "/api/admin/health",
        "/api/admin/stats",
        "/api/admin/users",
    ]

    @pytest.mark.parametrize("ep", ENDPOINTS)
    def test_unauthenticated_401(self, ep):
        r = requests.get(f"{BASE_URL}{ep}", timeout=15)
        assert r.status_code in (401, 403), f"{ep}: expected 401/403, got {r.status_code}"

    @pytest.mark.parametrize("ep", ENDPOINTS)
    def test_non_admin_403(self, fresh_user, ep):
        r = requests.get(
            f"{BASE_URL}{ep}",
            headers={"Authorization": f"Bearer {fresh_user['token']}"},
            timeout=15,
        )
        assert r.status_code == 403, f"{ep}: non-admin should be 403, got {r.status_code}: {r.text[:200]}"


# ---------- /admin/connectors/stats ----------

class TestAdminConnectorsStats:
    def test_returns_200_and_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/connectors/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "connectors" in data
        assert isinstance(data["connectors"], list)

    def test_has_9_entries_covering_expected(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/connectors/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        ids = {c["connector_id"] for c in r.json()["connectors"]}
        missing = EXPECTED_CONNECTORS - ids
        assert not missing, f"Missing connectors: {missing}. Got: {ids}"
        # Should be at least 9 (could include extras like 'glucose_meter' etc, but spec says 9)
        assert len(ids) >= 9, f"Expected >=9 connectors, got {len(ids)}"

    def test_each_entry_has_required_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/connectors/stats", headers=admin_headers, timeout=15)
        for c in r.json()["connectors"]:
            for fld in ("connector_id", "name", "icon", "color", "total_seats", "connected_seats", "adoption_pct"):
                assert fld in c, f"Missing field '{fld}' in {c}"
            assert isinstance(c["total_seats"], int)
            assert isinstance(c["connected_seats"], int)
            assert 0 <= c["adoption_pct"] <= 100, f"adoption_pct out of range: {c['adoption_pct']}"

    def test_sorted_by_connected_seats_desc(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/connectors/stats", headers=admin_headers, timeout=15)
        seats = [c["connected_seats"] for c in r.json()["connectors"]]
        assert seats == sorted(seats, reverse=True), f"Not sorted DESC: {seats}"


# ---------- /admin/devices/stats ----------

class TestAdminDevicesStats:
    def test_returns_200_and_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/devices/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        for k in ("total_devices", "users_with_devices", "max_devices_per_user", "avg_devices_per_user", "platforms"):
            assert k in d, f"Missing key: {k}"
        assert isinstance(d["platforms"], list)

    def test_device_registration_increments_total(self, admin_headers, fresh_user):
        before = requests.get(f"{BASE_URL}/api/admin/devices/stats", headers=admin_headers, timeout=15).json()
        before_count = before["total_devices"]

        # Register 2 devices for fresh_user
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/devices/register",
                headers={"Authorization": f"Bearer {fresh_user['token']}", "Content-Type": "application/json"},
                json={
                    "device_id": f"v8-dev-{uuid.uuid4().hex[:8]}",
                    "label": f"iPhone v8 #{i}",
                    "platform": "ios",
                },
                timeout=15,
            )
            assert r.status_code in (200, 201), f"device register failed: {r.status_code} {r.text}"

        after = requests.get(f"{BASE_URL}/api/admin/devices/stats", headers=admin_headers, timeout=15).json()
        assert after["total_devices"] >= before_count + 2, (
            f"total_devices did not increment: before={before_count} after={after['total_devices']}"
        )


# ---------- /admin/engagement ----------

class TestAdminEngagement:
    def test_returns_200_and_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/engagement", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        for k in ("dau", "wau", "mau", "new_signups_24h", "new_signups_7d",
                  "wau_dau_ratio", "scheduled_to_churn", "churn_pct"):
            assert k in d, f"Missing key: {k}"
            assert isinstance(d[k], (int, float)), f"{k} is not numeric: {type(d[k]).__name__}"

    def test_no_div_by_zero(self, admin_headers):
        d = requests.get(f"{BASE_URL}/api/admin/engagement", headers=admin_headers, timeout=15).json()
        # If dau is 0, ratio must be 0 (not error and not NaN)
        if d["dau"] == 0:
            assert d["wau_dau_ratio"] == 0, f"Expected ratio 0 when dau=0, got {d['wau_dau_ratio']}"


# ---------- /admin/health ----------

class TestAdminHealth:
    def test_returns_200_and_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        assert "ok" in d
        assert "timestamp" in d
        assert "checks" in d
        for chk in ("mongo", "emergent_llm_key", "stripe", "jwt", "indexes"):
            assert chk in d["checks"], f"Missing check: {chk}"

    def test_mongo_ok(self, admin_headers):
        d = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers, timeout=15).json()
        assert d["checks"]["mongo"]["ok"] is True

    def test_jwt_ok(self, admin_headers):
        d = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers, timeout=15).json()
        assert d["checks"]["jwt"]["ok"] is True

    def test_indexes_ok(self, admin_headers):
        d = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers, timeout=15).json()
        assert d["checks"]["indexes"]["ok"] is True

    def test_stripe_mode_valid(self, admin_headers):
        d = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers, timeout=15).json()
        mode = d["checks"]["stripe"].get("mode")
        assert mode in ("live", "test", "dev_fallback"), f"Unexpected stripe mode: {mode}"


# ---------- /admin/users/{user_id} (GET detail) ----------

class TestAdminUserDetail:
    def test_returns_200_and_shape(self, admin_headers, fresh_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{fresh_user['user_id']}",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        d = r.json()
        for k in ("user", "watches", "connectors_connected", "connectors_total", "devices", "recent_syncs", "goals"):
            assert k in d, f"Missing key: {k}"

    def test_connectors_total_is_9_for_seeded_user(self, admin_headers, fresh_user):
        # Trigger seeding of connectors by listing them (registration auto-seeds 9 per user)
        requests.get(
            f"{BASE_URL}/api/connectors",
            headers={"Authorization": f"Bearer {fresh_user['token']}"},
            timeout=15,
        )
        d = requests.get(
            f"{BASE_URL}/api/admin/users/{fresh_user['user_id']}",
            headers=admin_headers,
            timeout=15,
        ).json()
        assert d["connectors_total"] == 9, f"connectors_total expected 9, got {d['connectors_total']}"

    def test_unknown_user_404(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/nonexistent-id-xyz",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 404


# ---------- DELETE /admin/users/{user_id} ----------

class TestAdminDeleteUser:
    def test_self_delete_blocked(self, admin_headers, admin_id):
        r = requests.delete(
            f"{BASE_URL}/api/admin/users/{admin_id}",
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:300]}"
        body = r.json()
        msg = body.get("detail") or body.get("message") or ""
        assert "Admins cannot delete their own account" in str(msg) or "cannot delete" in str(msg).lower()

    def test_delete_non_admin_with_cascade(self, admin_headers, fresh_user):
        uid = fresh_user["user_id"]
        token = fresh_user["token"]
        # Pre-populate: register a device + connect a connector + create goal
        requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"device_id": f"v8-cascade-{uuid.uuid4().hex[:8]}",
                  "label": "Cascade-test Pixel",
                  "platform": "android"},
            timeout=15,
        )
        # Connect a connector
        requests.post(
            f"{BASE_URL}/api/connectors/apple_health/connect",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        # Verify user exists in admin/users
        users_list = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=15).json()
        ids_before = {u["id"] for u in (users_list if isinstance(users_list, list) else users_list.get("users", []))}
        assert uid in ids_before, f"User {uid} not present before delete"

        # DELETE
        r = requests.delete(
            f"{BASE_URL}/api/admin/users/{uid}",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("deleted_user_id") == uid
        assert body.get("deleted_email", "").lower() == fresh_user["email"].lower()

        # Verify user gone from /admin/users
        users_list2 = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=15).json()
        ids_after = {u["id"] for u in (users_list2 if isinstance(users_list2, list) else users_list2.get("users", []))}
        assert uid not in ids_after, f"User {uid} still in /admin/users after delete"

        # Verify cascade: /admin/users/{uid} → 404
        r2 = requests.get(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_headers, timeout=15)
        assert r2.status_code == 404, f"Expected 404 after delete, got {r2.status_code}"


# ---------- Regression smoke ----------

class TestRegressionSmoke:
    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_users(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_audit(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/audit", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_billing_health(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/billing/health", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_metrics_summary(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/metrics/summary", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 33

    def test_connectors_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_watches_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/watches", headers=admin_headers, timeout=15)
        assert r.status_code == 200
