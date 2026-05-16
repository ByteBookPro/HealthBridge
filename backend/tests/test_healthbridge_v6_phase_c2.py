"""HealthBridge Phase C v2 backend tests (bulk connect + device profiles + per-device primary).

Covers the three follow-ups added on top of Phase C v1:
- POST /api/connectors/connect-all  with body variants {platforms,connector_ids,{}}
- POST /api/devices/register  + GET /api/devices  (upsert + listing)
- GET  /api/metrics/availability?device_id=...  (echo + primary_is_device_specific)
- POST /api/connectors/primary with device_id  (per-device override)
- DELETE /api/connectors/primary/{metric}?device_id=...  (fallback to global)
- Disconnect re-assignment with mix of global + device-specific primaries
- Regression smoke on auth + watches + summary + categories
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break

API = f"{BASE_URL.rstrip('/')}/api"
ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASS = "ySk4rWp4nSn5KsB8WvI4iF"
DEMO_EMAIL = "demo@healthbridge.app"
DEMO_PASS = "Demo1234!"

IOS_CONNECTORS = {"apple_health", "fitbit", "garmin", "myfitnesspal",
                  "strava", "oura", "withings"}
ANDROID_CONNECTORS = {"google_fit", "samsung_health", "fitbit", "garmin",
                      "myfitnesspal", "strava", "oura", "withings"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()


def _register(s, email=None):
    email = email or f"phc2_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass1234!", "name": "PhaseC2"}, timeout=20)
    assert r.status_code == 201, r.text
    return r.json(), email


@pytest.fixture()
def fresh_auth(s):
    body, email = _register(s)
    return {"Authorization": f"Bearer {body['access_token']}"}, email


@pytest.fixture(scope="session")
def admin_auth(s):
    body = _login(s, ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {body['access_token']}"}


# ---------- 1. Bulk connect ----------
class TestBulkConnect:
    def test_bulk_connect_ios_only(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/connectors/connect-all",
                   json={"platforms": ["ios"]}, headers=auth, timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 9
        connected = {c["connector_id"] for c in arr if c.get("connected")}
        # every connector whose platforms contain "ios" must be connected
        assert connected == IOS_CONNECTORS, f"expected {IOS_CONNECTORS}, got {connected}"
        # google_fit / samsung_health (android-only) must remain disconnected
        for cid in {"google_fit", "samsung_health"}:
            row = next(c for c in arr if c["connector_id"] == cid)
            assert row["connected"] is False, f"{cid} should remain disconnected"

    def test_bulk_connect_android_only(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/connectors/connect-all",
                   json={"platforms": ["android"]}, headers=auth, timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        connected = {c["connector_id"] for c in arr if c.get("connected")}
        assert connected == ANDROID_CONNECTORS
        ah = next(c for c in arr if c["connector_id"] == "apple_health")
        assert ah["connected"] is False, "apple_health is iOS-only"

    def test_bulk_connect_no_filter_connects_everything(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/connectors/connect-all", json={}, headers=auth, timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert all(c.get("connected") for c in arr), "every connector should be connected"
        assert len(arr) == 9

    def test_bulk_connect_specific_ids(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/connectors/connect-all",
                   json={"connector_ids": ["fitbit", "garmin"]}, headers=auth, timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        connected = {c["connector_id"] for c in arr if c.get("connected")}
        assert connected == {"fitbit", "garmin"}, f"only fitbit+garmin should connect, got {connected}"

    def test_bulk_connect_is_idempotent(self, s, fresh_auth):
        """Calling twice should not crash and should result in same connected set."""
        auth, _ = fresh_auth
        s.post(f"{API}/connectors/connect-all", json={"platforms": ["ios"]}, headers=auth, timeout=20)
        r2 = s.post(f"{API}/connectors/connect-all", json={"platforms": ["ios"]}, headers=auth, timeout=20)
        assert r2.status_code == 200, r2.text
        connected = {c["connector_id"] for c in r2.json() if c.get("connected")}
        assert connected == IOS_CONNECTORS


# ---------- 2. Device register / list ----------
class TestDevicesRegistry:
    def test_register_then_list(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        r = s.post(f"{API}/devices/register",
                   json={"device_id": did, "label": "Test iPhone", "platform": "ios"},
                   headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"ok": True, "device_id": did}

        r2 = s.get(f"{API}/devices", headers=auth, timeout=15)
        assert r2.status_code == 200, r2.text
        arr = r2.json()
        assert isinstance(arr, list) and len(arr) >= 1
        rec = next((d for d in arr if d["device_id"] == did), None)
        assert rec is not None
        assert rec["label"] == "Test iPhone"
        assert rec["platform"] == "ios"
        assert "last_seen_at" in rec and rec["last_seen_at"]

    def test_register_upserts_label(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        s.post(f"{API}/devices/register",
               json={"device_id": did, "label": "Old Label", "platform": "ios"},
               headers=auth, timeout=15)
        r = s.post(f"{API}/devices/register",
                   json={"device_id": did, "label": "New Label", "platform": "ios"},
                   headers=auth, timeout=15)
        assert r.status_code == 200
        arr = s.get(f"{API}/devices", headers=auth, timeout=15).json()
        rec = next(d for d in arr if d["device_id"] == did)
        assert rec["label"] == "New Label", "label should upsert"

    def test_register_validates_min_length(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/devices/register",
                   json={"device_id": "x", "label": "ok"}, headers=auth, timeout=15)
        assert r.status_code in (400, 422), f"too-short device_id should fail, got {r.status_code}"


# ---------- 3. Availability echoes device_id + primary_is_device_specific ----------
class TestAvailabilityDeviceEcho:
    def test_availability_without_device_id(self, s, fresh_auth):
        auth, _ = fresh_auth
        s.post(f"{API}/connectors/apple_health/connect", headers=auth, timeout=15)
        r = s.get(f"{API}/metrics/availability", headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "metrics" in body
        assert body.get("device_id") is None
        for m, info in body["metrics"].items():
            assert info["primary_is_device_specific"] is False, \
                f"{m} should not be device-specific when no device_id"

    def test_availability_with_device_id(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        s.post(f"{API}/devices/register",
               json={"device_id": did, "label": "Test iPhone", "platform": "ios"},
               headers=auth, timeout=15)
        s.post(f"{API}/connectors/apple_health/connect", headers=auth, timeout=15)
        r = s.get(f"{API}/metrics/availability",
                  params={"device_id": did}, headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("device_id") == did, "device_id should echo at top level"
        # primary_is_device_specific must exist on every metric entry
        for m, info in body["metrics"].items():
            assert "primary_is_device_specific" in info
            # Nothing per-device set yet → all False
            assert info["primary_is_device_specific"] is False


# ---------- 4. Per-device primary override ----------
class TestPerDevicePrimary:
    def _setup(self, s, auth, did):
        s.post(f"{API}/devices/register",
               json={"device_id": did, "label": "Test iPhone", "platform": "ios"},
               headers=auth, timeout=15)
        s.post(f"{API}/connectors/apple_health/connect", headers=auth, timeout=15)
        s.post(f"{API}/connectors/fitbit/connect", headers=auth, timeout=15)

    def test_set_device_primary_isolates_from_global(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        self._setup(s, auth, did)
        # Account-global primary for steps was auto-set to apple_health on connect.
        r = s.get(f"{API}/metrics/availability", headers=auth, timeout=15).json()
        assert r["metrics"]["steps"]["primary"] == "apple_health"

        # Set device-specific primary to fitbit
        r = s.post(f"{API}/connectors/primary",
                   json={"metric": "steps", "connector_id": "fitbit", "device_id": did},
                   headers=auth, timeout=15)
        assert r.status_code == 200, r.text

        # With device_id → fitbit + flagged
        with_dev = s.get(f"{API}/metrics/availability",
                         params={"device_id": did}, headers=auth, timeout=15).json()
        assert with_dev["metrics"]["steps"]["primary"] == "fitbit"
        assert with_dev["metrics"]["steps"]["primary_is_device_specific"] is True

        # Without device_id → apple_health and flag False
        no_dev = s.get(f"{API}/metrics/availability", headers=auth, timeout=15).json()
        assert no_dev["metrics"]["steps"]["primary"] == "apple_health"
        assert no_dev["metrics"]["steps"]["primary_is_device_specific"] is False

    def test_delete_device_primary_falls_back_to_global(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        self._setup(s, auth, did)
        s.post(f"{API}/connectors/primary",
               json={"metric": "steps", "connector_id": "fitbit", "device_id": did},
               headers=auth, timeout=15)
        # DELETE device override
        r = s.delete(f"{API}/connectors/primary/steps",
                     params={"device_id": did}, headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        # Now availability with device_id should fall back to global apple_health
        body = s.get(f"{API}/metrics/availability",
                     params={"device_id": did}, headers=auth, timeout=15).json()
        assert body["metrics"]["steps"]["primary"] == "apple_health"
        assert body["metrics"]["steps"]["primary_is_device_specific"] is False

    def test_set_global_primary_does_not_change_device_override(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        self._setup(s, auth, did)
        # Device override → fitbit
        s.post(f"{API}/connectors/primary",
               json={"metric": "steps", "connector_id": "fitbit", "device_id": did},
               headers=auth, timeout=15)
        # Connect garmin and switch global to garmin
        s.post(f"{API}/connectors/garmin/connect", headers=auth, timeout=15)
        r = s.post(f"{API}/connectors/primary",
                   json={"metric": "steps", "connector_id": "garmin"},
                   headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        # No device_id → garmin
        body_g = s.get(f"{API}/metrics/availability", headers=auth, timeout=15).json()
        assert body_g["metrics"]["steps"]["primary"] == "garmin"
        # With device_id → still fitbit
        body_d = s.get(f"{API}/metrics/availability",
                       params={"device_id": did}, headers=auth, timeout=15).json()
        assert body_d["metrics"]["steps"]["primary"] == "fitbit"

    def test_disconnect_reassigns_both_global_and_device(self, s, fresh_auth):
        auth, _ = fresh_auth
        did = "dev-test-iphone"
        # Connect apple_health + fitbit, set device-specific to apple_health and global to apple_health
        s.post(f"{API}/devices/register",
               json={"device_id": did, "label": "Test iPhone", "platform": "ios"},
               headers=auth, timeout=15)
        s.post(f"{API}/connectors/apple_health/connect", headers=auth, timeout=15)
        s.post(f"{API}/connectors/fitbit/connect", headers=auth, timeout=15)
        # device-specific primary → apple_health
        s.post(f"{API}/connectors/primary",
               json={"metric": "steps", "connector_id": "apple_health", "device_id": did},
               headers=auth, timeout=15)
        # Now disconnect apple_health → both primaries should reassign to fitbit
        r = s.post(f"{API}/connectors/apple_health/disconnect", headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        glob = s.get(f"{API}/metrics/availability", headers=auth, timeout=15).json()
        assert glob["metrics"]["steps"]["primary"] == "fitbit", \
            f"global should reassign to fitbit, got {glob['metrics']['steps']['primary']}"
        dev = s.get(f"{API}/metrics/availability",
                    params={"device_id": did}, headers=auth, timeout=15).json()
        assert dev["metrics"]["steps"]["primary"] == "fitbit"

    def test_set_primary_404_when_connector_unknown(self, s, fresh_auth):
        auth, _ = fresh_auth
        r = s.post(f"{API}/connectors/primary",
                   json={"metric": "steps", "connector_id": "does_not_exist"},
                   headers=auth, timeout=15)
        assert r.status_code == 404

    def test_set_primary_400_when_disconnected(self, s, fresh_auth):
        auth, _ = fresh_auth
        # apple_health exists but is NOT connected on a fresh user
        r = s.post(f"{API}/connectors/primary",
                   json={"metric": "steps", "connector_id": "apple_health"},
                   headers=auth, timeout=15)
        assert r.status_code == 400


# ---------- 5. Regression smoke ----------
class TestRegressionSmoke:
    def test_admin_login_works(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_demo_login_works(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=15)
        assert r.status_code == 200

    def test_watches_listing(self, s, admin_auth):
        r = s.get(f"{API}/watches", headers=admin_auth, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_metrics_summary(self, s, admin_auth):
        r = s.get(f"{API}/metrics/summary", headers=admin_auth, timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Must have at least metrics or categories shape
        assert isinstance(body, (list, dict))

    def test_metrics_categories(self, s, admin_auth):
        r = s.get(f"{API}/metrics/categories", headers=admin_auth, timeout=15)
        assert r.status_code == 200

    def test_single_connector_connect_disconnect_still_works(self, s, fresh_auth):
        auth, _ = fresh_auth
        c = s.post(f"{API}/connectors/strava/connect", headers=auth, timeout=15)
        assert c.status_code == 200 and c.json().get("connected") is True
        d = s.post(f"{API}/connectors/strava/disconnect", headers=auth, timeout=15)
        assert d.status_code == 200 and d.json().get("connected") is False
