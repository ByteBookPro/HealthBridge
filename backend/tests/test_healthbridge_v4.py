"""HealthBridge v4 backend integration tests.

Covers:
- REGRESSION: GET /api/migrate/jobs/{id} datetime fix (no 500)
- AI Health Insights (PRO): POST /api/insights/generate, GET /api/insights
- Goals (PRO): POST/GET/DELETE /api/goals
- Weekly report (PRO): GET /api/reports/weekly
- PRO gating (402 for free, success for PRO)
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
ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASS = "ySk4rWp4nSn5KsB8WvI4iF"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_auth(s):
    body = _login(s, ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {body['access_token']}"}, None


@pytest.fixture(scope="session")
def free_user_auth(s):
    """Spawn a brand-new free-tier user (avoids demo getting upgraded mid-suite)."""
    email = f"v4free_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Pass1234!", "name": "V4Free"}, timeout=20)
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, None, email


# ---------- 1. REGRESSION: migrate_get datetime fix ----------
class TestMigrateGetRegression:
    def test_migrate_get_does_not_500_and_progresses(self, s, admin_auth):
        auth, _ = admin_auth
        # Start a job
        start = s.post(f"{API}/migrate/start",
                       json={"source": "apple", "target": "samsung", "range_days": 30},
                       headers=auth)
        assert start.status_code == 200, start.text
        job_id = start.json()["id"]

        # Sleep so progress > 0 is guaranteed (~12s converges to 100%)
        time.sleep(3)

        g = s.get(f"{API}/migrate/jobs/{job_id}", headers=auth)
        assert g.status_code == 200, f"REGRESSION: migrate_get returned {g.status_code}: {g.text}"
        body = g.json()
        assert body["progress"] > 0, f"expected progress > 0 after 3s, got {body}"
        assert body["status"] in ("running", "completed")


# ---------- 2. AI Health Insights (PRO gating + generation) ----------
class TestInsightsGating:
    def test_free_user_gets_402(self, s, free_user_auth):
        auth, _user, _email = free_user_auth
        r = s.post(f"{API}/insights/generate", headers=auth)
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"
        assert "PRO" in r.text

    def test_insights_requires_auth(self, s):
        r = s.post(f"{API}/insights/generate")
        assert r.status_code == 401


class TestInsightsGeneration:
    def test_pro_admin_generates_four_insights(self, s, admin_auth):
        auth, _ = admin_auth
        r = s.post(f"{API}/insights/generate", headers=auth, timeout=60)
        assert r.status_code == 200, f"insights gen failed: {r.status_code} {r.text}"
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) == 4, f"expected 4 insights, got {len(arr)}: {arr}"
        # Shape check
        first = arr[0]
        for k in ("id", "title", "summary", "severity", "created_at"):
            assert k in first, f"missing {k} in insight: {first}"
        assert first["severity"] in ("info", "good", "warning", "critical")
        assert len(first["title"]) > 0
        assert len(first["summary"]) > 0

    def test_get_insights_returns_last_generated(self, s, admin_auth):
        auth, _ = admin_auth
        r = s.get(f"{API}/insights", headers=auth)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 4, f"expected 4 stored, got {len(arr)}"


# ---------- 3. Goals (PRO gating + CRUD) ----------
class TestGoalsGating:
    def test_free_user_cannot_create_goal(self, s, free_user_auth):
        auth, _user, _email = free_user_auth
        r = s.post(f"{API}/goals", headers=auth,
                   json={"metric": "steps", "target": 10000, "period": "daily"})
        assert r.status_code == 402, f"expected 402, got {r.status_code}: {r.text}"

    def test_free_user_can_list_goals_empty(self, s, free_user_auth):
        auth, _, _ = free_user_auth
        r = s.get(f"{API}/goals", headers=auth)
        assert r.status_code == 200
        assert r.json() == []


class TestGoalsCRUD:
    def test_pro_user_create_list_delete(self, s, admin_auth):
        auth, _ = admin_auth
        # Create
        create = s.post(f"{API}/goals", headers=auth,
                        json={"metric": "steps", "target": 12000, "period": "daily"})
        assert create.status_code == 201, create.text
        gobj = create.json()
        assert gobj["metric"] == "steps"
        assert gobj["target"] == 12000
        assert gobj["period"] == "daily"
        goal_id = gobj["id"]

        # List enriched
        lst = s.get(f"{API}/goals", headers=auth)
        assert lst.status_code == 200
        arr = lst.json()
        assert any(g["id"] == goal_id for g in arr)
        match = [g for g in arr if g["id"] == goal_id][0]
        for k in ("current", "progress_pct", "streak_days"):
            assert k in match

        # Delete
        d = s.delete(f"{API}/goals/{goal_id}", headers=auth)
        assert d.status_code == 200
        assert d.json().get("ok") is True

        # Verify gone
        lst2 = s.get(f"{API}/goals", headers=auth)
        assert not any(g["id"] == goal_id for g in lst2.json())


# ---------- 4. Weekly report (PRO) ----------
class TestWeeklyReport:
    def test_free_user_gets_402(self, s, free_user_auth):
        auth, _, _ = free_user_auth
        r = s.get(f"{API}/reports/weekly", headers=auth)
        assert r.status_code == 402

    def test_pro_user_gets_8_metric_breakdown(self, s, admin_auth):
        auth, _ = admin_auth
        r = s.get(f"{API}/reports/weekly", headers=auth)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("period_start", "period_end", "syncs_total", "breakdown"):
            assert k in body
        assert isinstance(body["breakdown"], list)
        assert len(body["breakdown"]) == 8, f"expected 8-metric breakdown, got {len(body['breakdown'])}"
        first = body["breakdown"][0]
        for k in ("metric", "label", "unit", "current", "avg", "min", "max", "change_pct"):
            assert k in first, f"missing {k} in breakdown row: {first}"
