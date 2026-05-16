"""
v7 regression test — MetricLiteral expansion fix verification.

Context: previous iteration (4) discovered a Pydantic ResponseValidationError on
GET /api/metrics/summary because the response-model Literal listed only 8 metric
names, but DEFAULT_METRICS_TEMPLATE emits 33. The fix expands MetricLiteral to
include all 33 metric names. These tests confirm the regression is closed and no
new ones were introduced.
"""

import os
import pytest
import requests

# BASE_URL — frontend uses EXPO_PUBLIC_BACKEND_URL; backend tests hit same public preview URL
BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    os.environ.get(
        "EXPO_PUBLIC_BACKEND_URL",
        "https://b5756d38-6d5c-4694-ae0a-e29e724ded9b.preview.emergentagent.com",
    ),
).rstrip("/")

ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASSWORD = "ySk4rWp4nSn5KsB8WvI4iF"

# The 33 metrics from DEFAULT_METRICS_TEMPLATE — must all be present in /metrics/summary
EXPECTED_METRICS = {
    # ACTIVITY (6)
    "steps", "distance", "active_minutes", "floors", "calories", "stand",
    # EXERCISE (5)
    "workouts", "workout_count", "vo2_max", "training_load", "recovery_time",
    # NUTRITION (6)
    "calorie_intake", "protein", "carbs", "fat", "water", "fiber",
    # BODY (6)
    "weight", "bmi", "body_fat", "muscle_mass", "sleep", "sleep_quality",
    # VITALS (10)
    "heart_rate", "resting_hr", "hrv", "blood_pressure_sys", "blood_pressure_dia",
    "spo2", "respiratory_rate", "body_temp", "ecg", "stress",
}

# Metrics NOT in the original 8 — these specifically validate the Literal expansion
NEWLY_ADDED_METRICS = [
    "distance", "active_minutes", "floors", "workout_count", "vo2_max",
    "training_load", "recovery_time", "calorie_intake", "protein", "carbs",
    "fat", "water", "fiber", "weight", "bmi", "body_fat", "muscle_mass",
    "sleep_quality", "resting_hr", "hrv", "blood_pressure_sys",
    "blood_pressure_dia", "respiratory_rate", "body_temp", "stress",
]


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No access_token/token in login response: {data}"
    return token


@pytest.fixture(scope="session")
def admin_client(api_client, admin_token):
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


# ---------- /metrics/summary regression ----------

class TestMetricsSummaryRegression:
    """Primary fix verification: /api/metrics/summary returns 200 with all 33 metrics."""

    def test_summary_returns_200(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/summary", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:500]}"

    def test_summary_returns_list_of_33(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/summary", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
        assert len(data) == 33, f"Expected 33 metrics, got {len(data)}: {[d.get('metric') for d in data]}"

    def test_summary_contains_all_expected_metric_names(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/summary", timeout=15)
        assert r.status_code == 200
        names = {item["metric"] for item in r.json()}
        missing = EXPECTED_METRICS - names
        extra = names - EXPECTED_METRICS
        assert not missing, f"Missing metrics: {missing}"
        assert not extra, f"Unexpected extra metrics: {extra}"

    def test_summary_item_schema(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/summary", timeout=15)
        assert r.status_code == 200
        for item in r.json():
            assert "metric" in item and isinstance(item["metric"], str)
            assert "label" in item
            assert "unit" in item
            assert "current" in item
            assert "goal" in item
            assert "trend" in item and isinstance(item["trend"], list)


# ---------- /metrics/summary/all regression ----------

class TestMetricsSummaryAll:
    def test_summary_all_returns_200_and_33(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/summary/all", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:500]}"
        data = r.json()
        # Could be a list or a dict-wrapped list — handle both
        items = data if isinstance(data, list) else data.get("metrics") or data.get("data") or data.get("items")
        assert items is not None, f"Could not locate metrics list in response: keys={list(data.keys()) if isinstance(data, dict) else 'N/A'}"
        assert isinstance(items, list)
        assert len(items) == 33, f"Expected 33, got {len(items)}"
        names = {it["metric"] for it in items}
        assert names == EXPECTED_METRICS, f"Mismatch. missing={EXPECTED_METRICS - names}, extra={names - EXPECTED_METRICS}"


# ---------- /metrics/categories regression ----------

class TestMetricsCategories:
    def test_categories_returns_200(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/categories", timeout=15)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:500]}"

    def test_categories_has_5_categories_and_33_metrics(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()

        # Actual shape: { "categories": [ {id, label, icon, color, metrics: [...]}, ... ], "total_metrics": N, "category_metadata": {...} }
        assert isinstance(data, dict), f"Expected dict, got {type(data).__name__}"
        assert "categories" in data, f"Missing 'categories' key: {list(data.keys())}"
        cats = data["categories"]
        assert isinstance(cats, list)

        # Expect 5 categories: activity, exercise, nutrition, body, vitals
        cat_ids = {c["id"] for c in cats}
        expected_cats = {"activity", "exercise", "nutrition", "body", "vitals"}
        assert cat_ids == expected_cats, f"Categories mismatch: got={cat_ids}, expected={expected_cats}"

        # Flatten metric names across all categories — must equal the 33 expected
        all_names = [m["metric"] for c in cats for m in c.get("metrics", [])]
        assert len(all_names) == 33, f"Expected 33 metrics across categories, got {len(all_names)}"
        assert set(all_names) == EXPECTED_METRICS, (
            f"Mismatch: missing={EXPECTED_METRICS - set(all_names)}, extra={set(all_names) - EXPECTED_METRICS}"
        )

        # Optional: total_metrics field if present should equal 33
        if "total_metrics" in data:
            assert data["total_metrics"] == 33, f"total_metrics={data['total_metrics']} != 33"


# ---------- /metrics/{metric}/detail for newly-added Literals ----------

class TestMetricDetailForNewlyAddedMetrics:
    """Confirm path-param validation accepts metrics that were not in the original 8."""

    @pytest.mark.parametrize("metric", ["distance", "vo2_max"])
    def test_detail_for_newly_added_metric(self, admin_client, metric):
        r = admin_client.get(f"{BASE_URL}/api/metrics/{metric}/detail", timeout=15)
        # Must NOT be 422 (the prior validation error) — should be 200
        assert r.status_code != 422, f"422 validation error for {metric}: {r.text[:500]}"
        assert r.status_code == 200, f"Expected 200 for {metric}, got {r.status_code}: {r.text[:500]}"
        data = r.json()
        assert isinstance(data, dict)
        assert data.get("metric") == metric, f"metric field mismatch: {data.get('metric')} != {metric}"

    @pytest.mark.parametrize("metric", NEWLY_ADDED_METRICS)
    def test_detail_no_422_for_all_newly_added(self, admin_client, metric):
        """Broader sweep — none of the 25 newly-added metric names should 422."""
        r = admin_client.get(f"{BASE_URL}/api/metrics/{metric}/detail", timeout=15)
        assert r.status_code != 422, f"422 validation error for {metric}: {r.text[:500]}"
        # Accept 200 (happy path). Some endpoints might 404 if data missing — still acceptable as long as not 422/500.
        assert r.status_code in (200, 404), f"Unexpected status for {metric}: {r.status_code} - {r.text[:200]}"


# ---------- Light regression — confirm iteration_4 endpoints still green ----------

class TestIteration4RegressionSmoke:
    """Spot-check a few endpoints that were green in iteration_4 to confirm no new regressions."""

    def test_connectors_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/connectors", timeout=15)
        assert r.status_code == 200, f"/connectors: {r.status_code} - {r.text[:300]}"
        data = r.json()
        # Could be list directly or wrapped
        items = data if isinstance(data, list) else data.get("connectors") or data.get("data")
        assert isinstance(items, list)
        assert len(items) >= 9, f"Expected >= 9 connectors, got {len(items)}"

    def test_metrics_availability(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/metrics/availability", timeout=15)
        assert r.status_code == 200, f"/metrics/availability: {r.status_code} - {r.text[:300]}"

    def test_auth_me(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200, f"/auth/me: {r.status_code} - {r.text[:300]}"
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
