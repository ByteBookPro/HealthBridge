"""HealthBridge v3 backend integration tests.

Covers:
- Migration Wizard: POST /api/migrate/start, GET /api/migrate/jobs, GET /api/migrate/jobs/{id}
- Notification Bridge: GET/PUT /api/bridge/notifications/settings,
  POST /api/bridge/notifications/event, GET /api/bridge/notifications/log
"""
import os
import time
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


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def demo_auth(s):
    r = s.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=20)
    if r.status_code == 401:
        r = s.post(f"{API}/auth/register",
                   json={"email": DEMO_EMAIL, "password": DEMO_PASS, "name": "Demo"}, timeout=20)
    assert r.status_code in (200, 201), f"auth failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def fresh_user_auth(s):
    """Spawn a dedicated user so migration/bridge tests don't collide with seeded data."""
    email = f"v3_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass1234!", "name": "V3"}, timeout=20)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, email


# ---------- Migration Wizard ----------
class TestMigrationStart:
    def test_start_returns_running_job_with_total(self, s, demo_auth):
        r = s.post(f"{API}/migrate/start",
                   json={"source": "apple", "target": "samsung", "range_days": 90},
                   headers=demo_auth)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["status"] == "running"
        assert job["source"] == "apple"
        assert job["target"] == "samsung"
        assert job["range_days"] == 90
        assert job["total"] > 0
        assert job["samples_migrated"] == 0
        assert job["progress"] == 0
        assert "id" in job and isinstance(job["id"], str)

    def test_start_rejects_same_source_and_target(self, s, demo_auth):
        r = s.post(f"{API}/migrate/start",
                   json={"source": "apple", "target": "apple", "range_days": 30},
                   headers=demo_auth)
        assert r.status_code == 400
        assert "differ" in r.text.lower() or "source" in r.text.lower()

    def test_start_requires_auth(self, s):
        r = s.post(f"{API}/migrate/start",
                   json={"source": "apple", "target": "samsung", "range_days": 30})
        assert r.status_code == 401


class TestMigrationProgress:
    def test_job_progresses_and_completes(self, s, demo_auth):
        # Start a quick job (range_days=30 → smaller total)
        r = s.post(f"{API}/migrate/start",
                   json={"source": "samsung", "target": "apple", "range_days": 30},
                   headers=demo_auth)
        assert r.status_code == 200
        job_id = r.json()["id"]
        total = r.json()["total"]

        # Server-side progress converges to 100 over ~12s. Poll up to 25s.
        completed = None
        for _ in range(25):
            time.sleep(1)
            g = s.get(f"{API}/migrate/jobs/{job_id}", headers=demo_auth)
            assert g.status_code == 200, g.text
            jd = g.json()
            if jd["status"] == "completed":
                completed = jd
                break
            assert jd["status"] == "running"
            assert 0 <= jd["progress"] <= 100
        assert completed is not None, f"Job did not complete within 25s; last={jd}"
        assert completed["progress"] == 100
        assert completed["samples_migrated"] == total
        assert completed["finished_at"] is not None
        assert completed["message"] and "Migrated" in completed["message"]

    def test_get_unknown_job_returns_404(self, s, demo_auth):
        r = s.get(f"{API}/migrate/jobs/does-not-exist-{uuid.uuid4().hex[:6]}",
                  headers=demo_auth)
        assert r.status_code == 404


class TestMigrationList:
    def test_list_returns_jobs_newest_first(self, s, fresh_user_auth):
        auth, _email = fresh_user_auth
        # Create two jobs with a brief gap to guarantee distinct started_at
        a = s.post(f"{API}/migrate/start",
                   json={"source": "apple", "target": "google", "range_days": 7},
                   headers=auth).json()
        time.sleep(1.1)
        b = s.post(f"{API}/migrate/start",
                   json={"source": "google", "target": "samsung", "range_days": 7},
                   headers=auth).json()
        r = s.get(f"{API}/migrate/jobs", headers=auth)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 2
        # newest first → second-created should appear before first-created
        ids = [j["id"] for j in lst]
        assert ids.index(b["id"]) < ids.index(a["id"]), \
            f"expected {b['id']} before {a['id']}, got {ids}"

    def test_list_requires_auth(self, s):
        r = s.get(f"{API}/migrate/jobs")
        assert r.status_code == 401


# ---------- Notification Bridge ----------
class TestNotificationBridgeSettings:
    def test_get_defaults(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        r = s.get(f"{API}/bridge/notifications/settings", headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["enabled"] is True
        assert isinstance(body["apps_allowed"], list)
        for app in ("messages", "whatsapp", "calls", "calendar"):
            assert app in body["apps_allowed"]
        assert body.get("silent_mode") is False

    def test_put_updates_apps_allowed(self, s, fresh_user_auth):
        auth, _ = fresh_user_auth
        new_allowed = ["messages", "slack"]
        payload = {
            "enabled": True,
            "apps_allowed": new_allowed,
            "silent_mode": False,
        }
        r = s.put(f"{API}/bridge/notifications/settings", json=payload, headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["apps_allowed"] == new_allowed
        # GET reflects persistence
        g = s.get(f"{API}/bridge/notifications/settings", headers=auth).json()
        assert g["apps_allowed"] == new_allowed

    def test_settings_requires_auth(self, s):
        r = s.get(f"{API}/bridge/notifications/settings")
        assert r.status_code == 401


class TestNotificationBridgeEvent:
    def _spawn(self, s):
        email = f"nb_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register",
                   json={"email": email, "password": "Pass1234!", "name": "NB"}, timeout=20)
        assert r.status_code == 201
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    def test_event_allowlisted_app_forwards(self, s):
        auth = self._spawn(s)
        r = s.post(f"{API}/bridge/notifications/event",
                   json={"app": "messages", "title": "Mom",
                         "body": "Are you home?", "watch_platform": "samsung"},
                   headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["forwarded"] is True
        assert "id" in body and isinstance(body["id"], str)

    def test_event_non_allowlisted_app_blocked(self, s):
        auth = self._spawn(s)
        r = s.post(f"{API}/bridge/notifications/event",
                   json={"app": "Tinder", "title": "Match",
                         "body": "you have a new match", "watch_platform": "samsung"},
                   headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["forwarded"] is False
        assert body["reason"] == "app_not_allowed"

    def test_event_when_disabled_returns_reason_disabled(self, s):
        auth = self._spawn(s)
        # turn the bridge off
        ru = s.put(f"{API}/bridge/notifications/settings",
                   json={"enabled": False, "apps_allowed": ["messages"], "silent_mode": False},
                   headers=auth)
        assert ru.status_code == 200
        r = s.post(f"{API}/bridge/notifications/event",
                   json={"app": "messages", "title": "x", "body": "y"},
                   headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["forwarded"] is False
        assert body["reason"] == "disabled"


class TestNotificationBridgeLog:
    def test_log_returns_events_newest_first(self, s):
        # spawn isolated user so ordering is deterministic
        email = f"nbl_{uuid.uuid4().hex[:8]}@example.com"
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": "Pass1234!", "name": "NBL"}, timeout=20)
        assert reg.status_code == 201
        auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        first = s.post(f"{API}/bridge/notifications/event",
                       json={"app": "messages", "title": "first", "body": "1"},
                       headers=auth).json()
        time.sleep(1.1)
        second = s.post(f"{API}/bridge/notifications/event",
                        json={"app": "whatsapp", "title": "second", "body": "2"},
                        headers=auth).json()

        r = s.get(f"{API}/bridge/notifications/log", headers=auth)
        assert r.status_code == 200, r.text
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 2
        ids = [d["id"] for d in lst]
        assert ids.index(second["id"]) < ids.index(first["id"]), \
            f"expected newest-first ordering, got {ids}"
        # shape check
        assert {"app", "title", "body", "status", "created_at"}.issubset(lst[0].keys())

    def test_log_requires_auth(self, s):
        r = s.get(f"{API}/bridge/notifications/log")
        assert r.status_code == 401
