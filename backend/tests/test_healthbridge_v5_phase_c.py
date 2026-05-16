"""HealthBridge Phase C backend tests.

Covers the new Connector + Metric-Availability + Watch-Proximity surface:
- GET /api/connectors auto-seeds 9 disconnected connectors on first call
- POST /api/connectors/{id}/connect (and primary auto-assignment)
- POST /api/connectors/{id}/disconnect (and primary re-assignment)
- GET  /api/metrics/availability — availability flips with connect/disconnect
- POST /api/connectors/primary — 200 / 400 / 404 paths
- POST /api/watches/{id}/proximity — shape + 404
- Regression smoke on a handful of older endpoints
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

EXPECTED_CONNECTORS = {
    "apple_health", "google_fit", "samsung_health", "fitbit", "garmin",
    "myfitnesspal", "strava", "oura", "withings",
}


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


@pytest.fixture(scope="session")
def admin_auth(s):
    body = _login(s, ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture(scope="session")
def demo_auth(s):
    body = _login(s, DEMO_EMAIL, DEMO_PASS)
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def fresh_user_auth(s):
    """Fresh user → clean connectors state (must auto-seed on first call)."""
    email = f"phc_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass1234!", "name": "PhaseC"}, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, email


# ---------- 1. Connector listing & auto-seed ----------
class TestConnectorsSeeding:
    def test_fresh_user_lists_9_disconnected(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        r = s.get(f"{API}/connectors", headers=auth)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        ids = {c["connector_id"] for c in arr}
        assert ids == EXPECTED_CONNECTORS, f"missing/extra connectors: {ids}"
        # All disconnected initially
        for c in arr:
            assert c["connected"] is False, f"{c['connector_id']} should start disconnected"
            for k in ("name", "icon", "color", "platforms", "metrics_provided"):
                assert k in c, f"missing {k} in {c}"
            assert isinstance(c["metrics_provided"], list) and len(c["metrics_provided"]) > 0

    def test_demo_user_connectors_auto_seeded(self, s, demo_auth):
        r = s.get(f"{API}/connectors", headers=demo_auth)
        assert r.status_code == 200
        arr = r.json()
        ids = {c["connector_id"] for c in arr}
        assert EXPECTED_CONNECTORS.issubset(ids)

    def test_admin_connectors_auto_seeded(self, s, admin_auth):
        r = s.get(f"{API}/connectors", headers=admin_auth)
        assert r.status_code == 200
        ids = {c["connector_id"] for c in r.json()}
        assert EXPECTED_CONNECTORS.issubset(ids)

    def test_connectors_requires_auth(self, s):
        r = s.get(f"{API}/connectors")
        assert r.status_code == 401


# ---------- 2. Connect / Disconnect flow + primary auto-assignment ----------
class TestConnectorConnectDisconnect:
    def test_404_for_unknown_connector(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        # Force seed
        s.get(f"{API}/connectors", headers=auth)
        r = s.post(f"{API}/connectors/does_not_exist/connect", headers=auth)
        assert r.status_code == 404

    def test_connect_apple_health_sets_primary_for_steps(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        # Before any connect → availability has steps unavailable
        av_before = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av_before["total_connected"] == 0
        assert av_before["metrics"]["steps"]["available"] is False
        assert av_before["metrics"]["steps"]["primary"] is None

        # Connect
        r = s.post(f"{API}/connectors/apple_health/connect", headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["connector_id"] == "apple_health"
        assert body["connected"] is True
        assert body.get("last_sync_at") is not None

        # Availability flipped
        av = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av["total_connected"] == 1
        for m in ("steps", "heart_rate", "sleep", "calories"):
            row = av["metrics"][m]
            assert row["available"] is True, f"{m} should be available: {row}"
            assert row["primary"] == "apple_health", f"{m} primary mismatch: {row}"
        # withings-only metric still unavailable
        assert av["metrics"]["weight"]["available"] is False
        assert av["metrics"]["weight"]["primary"] is None

    def test_disconnect_reassigns_or_clears_primary(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        s.get(f"{API}/connectors", headers=auth)  # ensure seeded

        # Connect apple_health then fitbit (both have steps)
        assert s.post(f"{API}/connectors/apple_health/connect", headers=auth).status_code == 200
        assert s.post(f"{API}/connectors/fitbit/connect", headers=auth).status_code == 200

        av = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av["metrics"]["steps"]["primary"] == "apple_health"
        assert set(av["metrics"]["steps"]["connected_providers"]) >= {"apple_health", "fitbit"}

        # Disconnect apple_health → primary for steps should be reassigned to fitbit
        r = s.post(f"{API}/connectors/apple_health/disconnect", headers=auth)
        assert r.status_code == 200, r.text
        assert r.json()["connected"] is False

        av2 = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av2["metrics"]["steps"]["primary"] == "fitbit"
        # vo2_max only provided by apple_health (in this two-connector subset), so it should be cleared
        # apple_health-only metrics like ecg should be unavailable + no primary
        assert av2["metrics"]["ecg"]["available"] is False
        assert av2["metrics"]["ecg"]["primary"] is None

        # Disconnect fitbit → steps now unavailable + primary cleared
        r2 = s.post(f"{API}/connectors/fitbit/disconnect", headers=auth)
        assert r2.status_code == 200
        av3 = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av3["metrics"]["steps"]["available"] is False
        assert av3["metrics"]["steps"]["primary"] is None
        assert av3["total_connected"] == 0


# ---------- 3. Set primary explicitly ----------
class TestSetPrimary:
    def test_set_primary_happy_path(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        s.get(f"{API}/connectors", headers=auth)
        s.post(f"{API}/connectors/apple_health/connect", headers=auth)
        s.post(f"{API}/connectors/fitbit/connect", headers=auth)

        r = s.post(f"{API}/connectors/primary", headers=auth,
                   json={"metric": "steps", "connector_id": "fitbit"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["connector_id"] == "fitbit"

        av = s.get(f"{API}/metrics/availability", headers=auth).json()
        assert av["metrics"]["steps"]["primary"] == "fitbit"

    def test_set_primary_404_when_unknown_connector(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        s.get(f"{API}/connectors", headers=auth)
        r = s.post(f"{API}/connectors/primary", headers=auth,
                   json={"metric": "steps", "connector_id": "no_such_one"})
        assert r.status_code == 404

    def test_set_primary_400_when_connector_not_connected(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        s.get(f"{API}/connectors", headers=auth)
        r = s.post(f"{API}/connectors/primary", headers=auth,
                   json={"metric": "steps", "connector_id": "fitbit"})
        assert r.status_code == 400, r.text

    def test_set_primary_400_when_connector_does_not_provide_metric(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        s.get(f"{API}/connectors", headers=auth)
        s.post(f"{API}/connectors/myfitnesspal/connect", headers=auth)
        # myfitnesspal doesn't provide steps
        r = s.post(f"{API}/connectors/primary", headers=auth,
                   json={"metric": "steps", "connector_id": "myfitnesspal"})
        assert r.status_code == 400, r.text


# ---------- 4. Watch proximity ----------
class TestWatchProximity:
    def test_proximity_shape(self, s, demo_auth):
        # Pick first watch for demo user
        watches = s.get(f"{API}/watches", headers=demo_auth).json()
        assert isinstance(watches, list) and len(watches) > 0, "demo user needs a seeded watch"
        wid = watches[0]["id"]

        found_in_range = False
        last_body = None
        for _ in range(5):  # up to 5 retries since in_range is randomized ~80%
            r = s.post(f"{API}/watches/{wid}/proximity", headers=demo_auth)
            assert r.status_code == 200, r.text
            last_body = r.json()
            for k in ("in_range", "rssi", "distance_m", "scanned_at"):
                assert k in last_body, f"missing {k}: {last_body}"
            assert isinstance(last_body["in_range"], bool)
            assert isinstance(last_body["rssi"], int) and -100 <= last_body["rssi"] <= -20
            assert isinstance(last_body["distance_m"], (int, float)) and last_body["distance_m"] > 0
            if last_body["in_range"]:
                found_in_range = True
                break
        assert found_in_range, f"proximity never returned in_range after 5 tries (last: {last_body})"

    def test_proximity_404_unknown_watch(self, s, demo_auth):
        r = s.post(f"{API}/watches/does_not_exist/proximity", headers=demo_auth)
        assert r.status_code == 404


# ---------- 5. Regression smoke for older endpoints ----------
class TestRegression:
    def test_auth_me(self, s, demo_auth):
        r = s.get(f"{API}/auth/me", headers=demo_auth)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_watches_list(self, s, demo_auth):
        r = s.get(f"{API}/watches", headers=demo_auth)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_metrics_summary_all(self, s, demo_auth):
        r = s.get(f"{API}/metrics/summary/all", headers=demo_auth)
        assert r.status_code == 200

    def test_metrics_categories(self, s, demo_auth):
        r = s.get(f"{API}/metrics/categories", headers=demo_auth)
        assert r.status_code == 200

    def test_metrics_sync_now(self, s, demo_auth):
        r = s.post(f"{API}/metrics/sync-now", headers=demo_auth)
        assert r.status_code in (200, 201)

    def test_admin_stats(self, s, admin_auth):
        r = s.get(f"{API}/admin/stats", headers=admin_auth)
        assert r.status_code == 200
