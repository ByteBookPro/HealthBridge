"""HealthBridge Vault backend integration tests.

Covers auth, watches, metrics, sync preferences/policy, events and vault export.
Tests hit the public preview URL and create/use the seeded demo account.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # frontend/.env loaded once
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break

API = f"{BASE_URL.rstrip('/')}/api"
DEMO_EMAIL = "demo@healthbridge.app"
DEMO_PASS = "Demo1234!"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def demo_token(s):
    # Try login first; if 401, register
    r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=20)
    if r.status_code == 401:
        r = s.post(f"{API}/auth/register", json={"email": DEMO_EMAIL, "password": DEMO_PASS, "name": "Demo"}, timeout=20)
    assert r.status_code in (200, 201), f"auth failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    return data


@pytest.fixture
def auth(demo_token):
    return {"Authorization": f"Bearer {demo_token['access_token']}"}


# ---------- Auth ----------
class TestAuth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_register_new_then_conflict(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234!", "name": "T"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["token_type"] == "bearer"
        # duplicate
        r2 = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234!"})
        assert r2.status_code == 409

    def test_register_short_password_422(self, s):
        r = s.post(f"{API}/auth/register", json={"email": f"x_{uuid.uuid4().hex[:6]}@hb.test", "password": "short"})
        assert r.status_code == 422

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong-password"})
        assert r.status_code == 401

    def test_me_requires_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, s, auth, demo_token):
        r = s.get(f"{API}/auth/me", headers=auth)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_refresh(self, s, demo_token):
        r = s.post(f"{API}/auth/refresh", json={"refresh_token": demo_token["refresh_token"]})
        assert r.status_code == 200
        assert "access_token" in r.json()


# ---------- Watches ----------
class TestWatches:
    def test_list(self, s, auth):
        r = s.get(f"{API}/watches", headers=auth)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        platforms = {w["platform"] for w in items}
        assert {"apple", "samsung"}.issubset(platforms)

    def test_toggle(self, s, auth):
        watches = s.get(f"{API}/watches", headers=auth).json()
        wid = watches[0]["id"]
        before = watches[0]["connected"]
        r = s.post(f"{API}/watches/{wid}/toggle", headers=auth)
        assert r.status_code == 200
        assert r.json()["connected"] != before
        # toggle back
        r2 = s.post(f"{API}/watches/{wid}/toggle", headers=auth)
        assert r2.json()["connected"] == before

    def test_toggle_404(self, s, auth):
        r = s.post(f"{API}/watches/nonexistent-id/toggle", headers=auth)
        assert r.status_code == 404


# ---------- Metrics ----------
class TestMetrics:
    def test_summary(self, s, auth):
        r = s.get(f"{API}/metrics/summary", headers=auth)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 8
        metrics = {m["metric"] for m in items}
        assert {"steps", "heart_rate", "sleep", "spo2", "ecg", "workouts", "calories", "stand"} == metrics
        for m in items:
            assert isinstance(m["trend"], list) and len(m["trend"]) >= 1

    def test_sync_now(self, s, auth):
        before = s.get(f"{API}/sync/events?limit=50", headers=auth).json()
        r = s.post(f"{API}/metrics/sync-now", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["synced"] >= 1
        after = s.get(f"{API}/sync/events?limit=50", headers=auth).json()
        assert len(after) > len(before)


# ---------- Sync prefs / policy / events ----------
class TestSync:
    def test_get_prefs(self, s, auth):
        r = s.get(f"{API}/sync/preferences", headers=auth)
        assert r.status_code == 200
        prefs = r.json()
        assert len(prefs) >= 8
        assert all("enabled" in p and "direction" in p for p in prefs)

    def test_update_pref_persists(self, s, auth):
        # toggle steps off then on
        payload = {"metric": "steps", "enabled": False, "direction": "bidirectional"}
        r = s.put(f"{API}/sync/preferences/steps", json=payload, headers=auth)
        assert r.status_code == 200
        prefs = s.get(f"{API}/sync/preferences", headers=auth).json()
        steps = next(p for p in prefs if p["metric"] == "steps")
        assert steps["enabled"] is False
        # revert
        s.put(f"{API}/sync/preferences/steps",
              json={"metric": "steps", "enabled": True, "direction": "bidirectional"},
              headers=auth)

    def test_policy_get_put(self, s, auth):
        r = s.get(f"{API}/sync/policy", headers=auth)
        assert r.status_code == 200
        cur = r.json()
        new = {"policy": "apple_wins", "background_sync": cur["background_sync"], "notifications": cur["notifications"]}
        r2 = s.put(f"{API}/sync/policy", json=new, headers=auth)
        assert r2.status_code == 200
        assert r2.json()["policy"] == "apple_wins"
        # verify persistence
        r3 = s.get(f"{API}/sync/policy", headers=auth)
        assert r3.json()["policy"] == "apple_wins"
        # revert
        s.put(f"{API}/sync/policy", json={**new, "policy": "latest_wins"}, headers=auth)

    def test_events_ordered_desc(self, s, auth):
        r = s.get(f"{API}/sync/events?limit=10", headers=auth)
        assert r.status_code == 200
        evts = r.json()
        assert len(evts) >= 1
        ts = [e["created_at"] for e in evts]
        assert ts == sorted(ts, reverse=True)


# ---------- Vault export ----------
class TestVault:
    def test_export_json(self, s, auth):
        r = s.get(f"{API}/vault/export?fmt=json", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["format"] == "json"
        assert isinstance(body["metrics"], list) and len(body["metrics"]) == 8
        assert isinstance(body["events"], list)

    def test_export_requires_auth(self, s):
        r = s.get(f"{API}/vault/export?fmt=json")
        assert r.status_code == 401
