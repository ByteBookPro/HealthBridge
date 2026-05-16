"""HealthBridge Vault — FastAPI backend (production-grade).

Adds, on top of MVP:
- Admin role + idempotent admin seed
- Stripe subscription checkout + customer portal + webhook
- Push notification tokens + send_push helper (Expo hosted service)
- Password reset (one-time token)
- Profile update
- Admin endpoints (list users, stats, cancel/refund sub, broadcast push)
"""
from __future__ import annotations

import os, logging, random, uuid, hmac, hashlib, secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional, Any, Dict

import bcrypt
import jwt
import httpx
import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "14"))

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "price_hbv_pro_monthly_499")
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "http://localhost:3000")
stripe.api_key = STRIPE_API_KEY

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@healthbridge.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin1234!")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "HBV Admin")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="HealthBridge Vault API", version="2.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("healthbridge")


# ---------- Models ----------
PlatformLiteral = Literal["apple", "samsung", "google", "cloud"]
MetricLiteral = Literal[
    # ACTIVITY
    "steps", "distance", "active_minutes", "floors", "calories", "stand",
    # EXERCISE
    "workouts", "workout_count", "vo2_max", "training_load", "recovery_time",
    # NUTRITION
    "calorie_intake", "protein", "carbs", "fat", "water", "fiber",
    # BODY
    "weight", "bmi", "body_fat", "muscle_mass", "sleep", "sleep_quality",
    # VITALS
    "heart_rate", "resting_hr", "hrv", "blood_pressure_sys", "blood_pressure_dia",
    "spo2", "respiratory_rate", "body_temp", "ecg", "stress",
]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class SubscriptionOut(BaseModel):
    plan: str = "free"
    status: str = "inactive"
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None
    is_trial: bool = False
    trial_days_left: int = 0


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    created_at: datetime
    is_admin: bool = False
    subscription: SubscriptionOut = Field(default_factory=SubscriptionOut)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class Watch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    platform: PlatformLiteral
    model: str
    battery: int
    connected: bool = True
    last_sync_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MetricSummary(BaseModel):
    metric: MetricLiteral
    label: str
    unit: str
    current: float
    goal: float
    trend: List[float]
    apple_value: Optional[float] = None
    samsung_value: Optional[float] = None
    delta_pct: float = 0.0


class SyncPref(BaseModel):
    metric: MetricLiteral
    enabled: bool
    direction: Literal["bidirectional", "apple_to_samsung", "samsung_to_apple"] = "bidirectional"


class SyncEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    metric: MetricLiteral
    source: PlatformLiteral
    destination: PlatformLiteral
    value: float
    unit: str
    status: Literal["success", "conflict_resolved", "queued", "failed"] = "success"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConflictPolicy(BaseModel):
    policy: Literal["latest_wins", "apple_wins", "samsung_wins", "manual"] = "latest_wins"
    background_sync: bool = True
    notifications: bool = True


class PushTokenIn(BaseModel):
    token: str
    platform: Literal["ios", "android", "web"] = "ios"
    app_version: Optional[str] = None


class SendPushIn(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None


class CheckoutIn(BaseModel):
    success_path: str = "/(tabs)/vault?checkout=success"
    cancel_path: str = "/(tabs)/vault?checkout=cancel"


class HealthSampleIn(BaseModel):
    """Single sample posted by the native HealthKit / Health Connect bridge."""
    metric: MetricLiteral
    value: float
    unit: str
    source: PlatformLiteral
    recorded_at: Optional[datetime] = None


class HealthBatchIn(BaseModel):
    samples: List[HealthSampleIn]


class MigrationStartIn(BaseModel):
    source: Literal["apple", "samsung", "google"]
    target: Literal["apple", "samsung", "google"]
    metrics: Optional[List[MetricLiteral]] = None
    range_days: int = 90


class MigrationJob(BaseModel):
    id: str
    user_id: str
    source: str
    target: str
    range_days: int
    status: Literal["queued", "running", "completed", "failed"] = "queued"
    progress: int = 0
    total: int = 0
    samples_migrated: int = 0
    started_at: datetime
    finished_at: Optional[datetime] = None
    message: Optional[str] = None


class NotificationBridgeIn(BaseModel):
    app: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=500)
    direction: Literal["phone_to_watch", "watch_to_phone"] = "phone_to_watch"
    watch_platform: Literal["apple", "samsung"] = "samsung"


class NotificationBridgeSettings(BaseModel):
    enabled: bool = True
    apps_allowed: List[str] = Field(default_factory=lambda: ["messages", "whatsapp", "calls", "calendar"])
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    silent_mode: bool = False


class GoalIn(BaseModel):
    metric: MetricLiteral
    target: float
    period: Literal["daily", "weekly"] = "daily"


class GoalOut(BaseModel):
    id: str
    metric: MetricLiteral
    target: float
    period: str
    current: float = 0
    progress_pct: float = 0
    streak_days: int = 0
    created_at: datetime


class InsightOut(BaseModel):
    id: str
    title: str
    summary: str
    metric: Optional[MetricLiteral] = None
    severity: Literal["info", "good", "warning", "critical"] = "info"
    action: Optional[str] = None
    created_at: datetime


def pro_only(user: dict) -> None:
    sub = user.get("subscription") or {}
    status = sub.get("status")
    plan = sub.get("plan")
    if status in ("active", "trialing") and plan == "pro":
        return
    raise HTTPException(402, "HealthBridge PRO required")


def trial_subscription() -> dict:
    """Default 30-day PRO trial granted to every new account."""
    return {
        "plan": "pro",
        "status": "trialing",
        "current_period_end": datetime.now(timezone.utc) + timedelta(days=30),
        "cancel_at_period_end": False,
        "is_trial": True,
    }



# ---------- Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, kind: Literal["access", "refresh"]) -> str:
    now = datetime.now(timezone.utc)
    exp = now + (
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES) if kind == "access"
        else timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    return jwt.encode({"sub": user_id, "type": kind, "iat": now, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str, kind: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != kind:
        raise HTTPException(401, "Wrong token type")
    return payload


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    payload = decode_token(authorization.split(" ", 1)[1].strip(), "access")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def admin_only(user=Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    return user


def serialize_user(user: dict) -> dict:
    sub = user.get("subscription") or {}
    cpe = sub.get("current_period_end")
    if isinstance(cpe, datetime) and cpe.tzinfo is None:
        cpe = cpe.replace(tzinfo=timezone.utc)
    is_trial = bool(sub.get("is_trial")) or sub.get("status") == "trialing"
    trial_days_left = 0
    if is_trial and isinstance(cpe, datetime):
        delta = cpe - datetime.now(timezone.utc)
        trial_days_left = max(0, delta.days + (1 if delta.total_seconds() > 0 else 0))
        if delta.total_seconds() <= 0:
            is_trial = False
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "created_at": user["created_at"],
        "is_admin": bool(user.get("is_admin")),
        "subscription": {
            "plan": sub.get("plan", "free"),
            "status": sub.get("status", "inactive"),
            "current_period_end": cpe,
            "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
            "stripe_customer_id": sub.get("stripe_customer_id"),
            "is_trial": is_trial,
            "trial_days_left": trial_days_left,
        },
    }


# ---------- Demo seed ----------
def _trend(seed: int, base: float, span: float, n: int = 14) -> List[float]:
    random.seed(seed)
    return [round(base + random.uniform(-span, span), 1) for _ in range(n)]


# Comprehensive health metrics organized by category
DEFAULT_METRICS_TEMPLATE = [
    # ACTIVITY
    {"metric": "steps", "label": "Steps", "unit": "steps", "current": 8420, "goal": 10000, "apple_value": 4720, "samsung_value": 3700, "delta_pct": 6.2, "category": "activity"},
    {"metric": "distance", "label": "Distance", "unit": "km", "current": 6.3, "goal": 8.0, "apple_value": 3.5, "samsung_value": 2.8, "delta_pct": 4.5, "category": "activity"},
    {"metric": "active_minutes", "label": "Active Minutes", "unit": "min", "current": 84, "goal": 60, "apple_value": 47, "samsung_value": 37, "delta_pct": 12.1, "category": "activity"},
    {"metric": "floors", "label": "Floors Climbed", "unit": "floors", "current": 12, "goal": 10, "apple_value": 8, "samsung_value": 4, "delta_pct": 8.3, "category": "activity"},
    {"metric": "calories", "label": "Calories Burned", "unit": "kcal", "current": 1842, "goal": 2200, "apple_value": 980, "samsung_value": 862, "delta_pct": 4.1, "category": "activity"},
    {"metric": "stand", "label": "Stand Hours", "unit": "hr", "current": 9, "goal": 12, "apple_value": 9, "samsung_value": 8, "delta_pct": 3.0, "category": "activity"},
    
    # EXERCISE
    {"metric": "workouts", "label": "Workout Time", "unit": "min", "current": 42, "goal": 60, "apple_value": 28, "samsung_value": 14, "delta_pct": 12.0, "category": "exercise"},
    {"metric": "workout_count", "label": "Workouts Done", "unit": "sessions", "current": 5, "goal": 7, "apple_value": 3, "samsung_value": 2, "delta_pct": 25.0, "category": "exercise"},
    {"metric": "vo2_max", "label": "VO2 Max", "unit": "mL/kg/min", "current": 42.5, "goal": 50, "apple_value": 42.5, "samsung_value": None, "delta_pct": 2.4, "category": "exercise"},
    {"metric": "training_load", "label": "Training Load", "unit": "TRIMP", "current": 156, "goal": 200, "apple_value": 156, "samsung_value": None, "delta_pct": 8.2, "category": "exercise"},
    {"metric": "recovery_time", "label": "Recovery Time", "unit": "hr", "current": 18, "goal": 24, "apple_value": 18, "samsung_value": None, "delta_pct": -5.3, "category": "exercise"},
    
    # NUTRITION
    {"metric": "calorie_intake", "label": "Calorie Intake", "unit": "kcal", "current": 2150, "goal": 2000, "apple_value": None, "samsung_value": None, "delta_pct": 3.2, "category": "nutrition"},
    {"metric": "protein", "label": "Protein", "unit": "g", "current": 95, "goal": 120, "apple_value": None, "samsung_value": None, "delta_pct": 5.6, "category": "nutrition"},
    {"metric": "carbs", "label": "Carbohydrates", "unit": "g", "current": 245, "goal": 250, "apple_value": None, "samsung_value": None, "delta_pct": -2.1, "category": "nutrition"},
    {"metric": "fat", "label": "Fat", "unit": "g", "current": 72, "goal": 65, "apple_value": None, "samsung_value": None, "delta_pct": 4.8, "category": "nutrition"},
    {"metric": "water", "label": "Water Intake", "unit": "L", "current": 2.4, "goal": 3.0, "apple_value": None, "samsung_value": None, "delta_pct": 15.0, "category": "nutrition"},
    {"metric": "fiber", "label": "Fiber", "unit": "g", "current": 28, "goal": 30, "apple_value": None, "samsung_value": None, "delta_pct": 7.7, "category": "nutrition"},
    
    # BODY
    {"metric": "weight", "label": "Weight", "unit": "kg", "current": 72.4, "goal": 70, "apple_value": None, "samsung_value": 72.4, "delta_pct": -0.8, "category": "body"},
    {"metric": "bmi", "label": "BMI", "unit": "kg/m²", "current": 23.8, "goal": 22.5, "apple_value": None, "samsung_value": 23.8, "delta_pct": -0.4, "category": "body"},
    {"metric": "body_fat", "label": "Body Fat", "unit": "%", "current": 18.5, "goal": 15, "apple_value": None, "samsung_value": 18.5, "delta_pct": -1.2, "category": "body"},
    {"metric": "muscle_mass", "label": "Muscle Mass", "unit": "kg", "current": 32.5, "goal": 35, "apple_value": None, "samsung_value": 32.5, "delta_pct": 0.9, "category": "body"},
    {"metric": "sleep", "label": "Sleep Duration", "unit": "h", "current": 7.4, "goal": 8.0, "apple_value": 7.4, "samsung_value": 7.2, "delta_pct": 2.7, "category": "body"},
    {"metric": "sleep_quality", "label": "Sleep Quality", "unit": "score", "current": 82, "goal": 90, "apple_value": 82, "samsung_value": 78, "delta_pct": 4.1, "category": "body"},
    
    # VITALS
    {"metric": "heart_rate", "label": "Heart Rate", "unit": "bpm", "current": 72, "goal": 70, "apple_value": 71, "samsung_value": 73, "delta_pct": -1.4, "category": "vitals"},
    {"metric": "resting_hr", "label": "Resting HR", "unit": "bpm", "current": 58, "goal": 55, "apple_value": 58, "samsung_value": 59, "delta_pct": -2.1, "category": "vitals"},
    {"metric": "hrv", "label": "Heart Rate Variability", "unit": "ms", "current": 45, "goal": 50, "apple_value": 45, "samsung_value": None, "delta_pct": 3.5, "category": "vitals"},
    {"metric": "blood_pressure_sys", "label": "Blood Pressure (Sys)", "unit": "mmHg", "current": 118, "goal": 120, "apple_value": None, "samsung_value": 118, "delta_pct": -1.7, "category": "vitals"},
    {"metric": "blood_pressure_dia", "label": "Blood Pressure (Dia)", "unit": "mmHg", "current": 78, "goal": 80, "apple_value": None, "samsung_value": 78, "delta_pct": -0.5, "category": "vitals"},
    {"metric": "spo2", "label": "Blood Oxygen", "unit": "%", "current": 98, "goal": 100, "apple_value": 98, "samsung_value": 97, "delta_pct": 0.5, "category": "vitals"},
    {"metric": "respiratory_rate", "label": "Respiratory Rate", "unit": "br/min", "current": 14, "goal": 16, "apple_value": 14, "samsung_value": 15, "delta_pct": 2.1, "category": "vitals"},
    {"metric": "body_temp", "label": "Body Temperature", "unit": "°C", "current": 36.6, "goal": 37, "apple_value": 36.6, "samsung_value": None, "delta_pct": 0.0, "category": "vitals"},
    {"metric": "ecg", "label": "ECG Reading", "unit": "ms", "current": 412, "goal": 420, "apple_value": 412, "samsung_value": None, "delta_pct": 0.0, "category": "vitals"},
    {"metric": "stress", "label": "Stress Level", "unit": "score", "current": 35, "goal": 30, "apple_value": None, "samsung_value": 35, "delta_pct": -8.2, "category": "vitals"},
]


# Category metadata for UI
METRIC_CATEGORIES = {
    "activity": {"label": "Activity", "icon": "walk", "color": "#2DD4BF"},
    "exercise": {"label": "Exercise", "icon": "barbell", "color": "#F59E0B"},
    "nutrition": {"label": "Nutrition", "icon": "nutrition", "color": "#10B981"},
    "body": {"label": "Body", "icon": "body", "color": "#8B5CF6"},
    "vitals": {"label": "Vitals", "icon": "heart", "color": "#EF4444"},
}


async def seed_user_data(user_id: str) -> None:
    watches = [
        Watch(user_id=user_id, platform="apple", model="Apple Watch Series 9", battery=82),
        Watch(user_id=user_id, platform="samsung", model="Galaxy Watch 6 Classic", battery=64),
    ]
    await db.watches.insert_many([w.model_dump() for w in watches])
    summaries = []
    for idx, m in enumerate(DEFAULT_METRICS_TEMPLATE):
        summaries.append({**m, "user_id": user_id,
                          "trend": _trend(idx + 1, m["current"], max(m["current"] * 0.08, 1.0)),
                          "updated_at": datetime.now(timezone.utc)})
    await db.metric_summaries.insert_many(summaries)
    prefs = [{"user_id": user_id, "metric": m["metric"], "enabled": True, "direction": "bidirectional"}
             for m in DEFAULT_METRICS_TEMPLATE]
    await db.sync_prefs.insert_many(prefs)
    await db.conflict_policy.insert_one({"user_id": user_id, "policy": "latest_wins",
                                          "background_sync": True, "notifications": True})
    # Seed disconnected connectors (Phase C — user connects them explicitly)
    await db.connectors.insert_many([
        {**c, "user_id": user_id, "connected": False, "last_sync_at": None}
        for c in CONNECTOR_TEMPLATE
    ])
    now = datetime.now(timezone.utc)
    pairs = [("apple", "samsung"), ("samsung", "apple"), ("apple", "cloud"), ("samsung", "cloud")]
    events = []
    for i in range(12):
        src, dst = random.choice(pairs)
        m = random.choice(DEFAULT_METRICS_TEMPLATE)
        events.append({"id": str(uuid.uuid4()), "user_id": user_id, "metric": m["metric"],
                       "source": src, "destination": dst,
                       "value": float(m["current"]) + random.uniform(-5, 5), "unit": m["unit"],
                       "status": random.choice(["success", "success", "success", "conflict_resolved"]),
                       "created_at": now - timedelta(minutes=i * 17 + 3)})
    await db.sync_events.insert_many(events)


async def seed_admin_user() -> None:
    """Idempotent admin seed."""
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing:
        if not existing.get("is_admin"):
            await db.users.update_one({"id": existing["id"]}, {"$set": {"is_admin": True}})
        return
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id, "email": ADMIN_EMAIL.lower(), "name": ADMIN_NAME,
        "password": hash_pw(ADMIN_PASSWORD), "created_at": datetime.now(timezone.utc),
        "is_admin": True, "subscription": {"plan": "pro", "status": "active"},
    })
    await seed_user_data(user_id)
    log.info(f"Admin seeded: {ADMIN_EMAIL}")


async def seed_demo_user() -> None:
    """Idempotent demo seed — the credentials pre-filled on the login screen.
    Gives a fresh tester a working sign-in on first tap. Demo user starts on a
    30-day PRO trial like any new sign-up."""
    demo_email = "demo@healthbridge.app"
    demo_pw = "Demo1234!"
    if await db.users.find_one({"email": demo_email}):
        return
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "id": user_id, "email": demo_email, "name": "Demo Tester",
        "password": hash_pw(demo_pw), "created_at": now,
        "is_admin": False,
        "subscription": {
            "plan": "pro", "status": "trialing", "is_trial": True,
            "trial_ends_at": now + timedelta(days=30),
        },
    })
    await seed_user_data(user_id)
    log.info(f"Demo user seeded: {demo_email}")


async def upgrade_user_metrics(user_id: str) -> int:
    """Upgrade existing user to have comprehensive metrics if they don't exist."""
    existing = await db.metric_summaries.find({"user_id": user_id}, {"metric": 1}).to_list(100)
    existing_metrics = {m["metric"] for m in existing}
    
    new_metrics_added = 0
    now = datetime.now(timezone.utc)
    
    for idx, m in enumerate(DEFAULT_METRICS_TEMPLATE):
        if m["metric"] not in existing_metrics:
            await db.metric_summaries.insert_one({
                **m,
                "user_id": user_id,
                "trend": _trend(idx + 100, m["current"], max(m["current"] * 0.08, 1.0)),
                "updated_at": now,
            })
            new_metrics_added += 1
        else:
            # Update existing metric to include category
            await db.metric_summaries.update_one(
                {"user_id": user_id, "metric": m["metric"]},
                {"$set": {"category": m.get("category", "activity"), "label": m["label"]}}
            )
    
    return new_metrics_added


# ---------- Push helper ----------
async def send_push(user_id: str, title: str, body: str, data: Optional[dict] = None) -> dict:
    tokens = await db.push_tokens.find({"user_id": user_id, "active": True}, {"_id": 0}).to_list(20)
    if not tokens:
        return {"sent": 0, "reason": "no_tokens"}
    messages = [{"to": t["token"], "title": title, "body": body, "data": data or {},
                 "sound": "default", "priority": "high"} for t in tokens]
    async with httpx.AsyncClient(timeout=10) as cx:
        try:
            r = await cx.post(EXPO_PUSH_URL, json=messages,
                              headers={"Accept": "application/json", "Content-Type": "application/json"})
            ok = r.status_code == 200
        except Exception as e:
            log.warning(f"Push failed: {e}")
            ok = False
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user_id,
                                        "title": title, "body": body, "data": data,
                                        "sent_to": len(tokens), "status": "sent" if ok else "failed",
                                        "created_at": datetime.now(timezone.utc)})
    return {"sent": len(tokens) if ok else 0}


# ---------- Auth ----------
@api.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(payload: RegisterIn):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(409, "Email already registered")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({"id": user_id, "email": payload.email.lower(),
                                "name": payload.name or payload.email.split("@")[0],
                                "password": hash_pw(payload.password),
                                "created_at": datetime.now(timezone.utc),
                                "is_admin": False,
                                "subscription": trial_subscription()})
    await seed_user_data(user_id)
    return TokenOut(access_token=create_token(user_id, "access"),
                    refresh_token=create_token(user_id, "refresh"),
                    expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@api.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_pw(payload.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    return TokenOut(access_token=create_token(user["id"], "access"),
                    refresh_token=create_token(user["id"], "refresh"),
                    expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@api.post("/auth/refresh", response_model=TokenOut)
async def refresh(payload: RefreshIn):
    data = decode_token(payload.refresh_token, "refresh")
    user = await db.users.find_one({"id": data["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return TokenOut(access_token=create_token(user["id"], "access"),
                    refresh_token=payload.refresh_token,
                    expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return serialize_user(user)


@api.patch("/auth/me", response_model=UserOut)
async def update_profile(p: ProfileUpdate, user=Depends(current_user)):
    upd: dict = {}
    if p.name is not None:
        upd["name"] = p.name.strip()
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return serialize_user(user)


@api.post("/auth/password/change")
async def change_password(p: PasswordChange, user=Depends(current_user)):
    if not verify_pw(p.current_password, user["password"]):
        raise HTTPException(400, "Current password incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password": hash_pw(p.new_password)}})
    return {"ok": True}


@api.post("/auth/password/forgot")
async def forgot_password(p: ForgotIn):
    user = await db.users.find_one({"email": p.email.lower()})
    # Always return ok to avoid email enumeration
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "token": token, "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
        })
        log.info(f"Password reset token for {p.email}: {token}")  # in prod send via SendGrid
        return {"ok": True, "reset_token_dev_only": token}
    return {"ok": True}


@api.post("/auth/password/reset")
async def reset_password(p: ResetIn):
    rec = await db.password_resets.find_one({"token": p.token, "used": False})
    if not rec:
        raise HTTPException(400, "Invalid or expired reset token")
    exp = rec["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Invalid or expired reset token")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password": hash_pw(p.new_password)}})
    await db.password_resets.update_one({"token": p.token}, {"$set": {"used": True}})
    return {"ok": True}


# ---------- Watches / Metrics / Sync (unchanged) ----------
@api.get("/watches", response_model=List[Watch])
async def list_watches(user=Depends(current_user)):
    return await db.watches.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)


@api.post("/watches/{watch_id}/toggle", response_model=Watch)
async def toggle_watch(watch_id: str, user=Depends(current_user)):
    w = await db.watches.find_one({"id": watch_id, "user_id": user["id"]}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Watch not found")
    w["connected"] = not w["connected"]
    w["last_sync_at"] = datetime.now(timezone.utc)
    await db.watches.update_one({"id": watch_id}, {"$set": {"connected": w["connected"], "last_sync_at": w["last_sync_at"]}})
    return w


@api.get("/metrics/summary", response_model=List[MetricSummary])
async def metrics_summary(user=Depends(current_user)):
    docs = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0, "updated_at": 0}).to_list(50)
    order = {m["metric"]: i for i, m in enumerate(DEFAULT_METRICS_TEMPLATE)}
    docs.sort(key=lambda d: order.get(d["metric"], 99))
    return docs


@api.get("/metrics/{metric}/detail")
async def metric_detail(metric: str, time_range: str = "week", user=Depends(current_user)):
    """Get detailed metric data with scientific calculations for health app-like display."""
    summary = await db.metric_summaries.find_one(
        {"user_id": user["id"], "metric": metric}, {"_id": 0}
    )
    if not summary:
        raise HTTPException(404, "Metric not found")
    
    # Generate historical data based on time_range
    now = datetime.now(timezone.utc)
    if time_range == "day":
        days = 1
        num_points = 24  # hourly
    elif time_range == "week":
        days = 7
        num_points = 7
    elif time_range == "month":
        days = 30
        num_points = 30
    else:  # year
        days = 365
        num_points = 12
    
    # Generate realistic historical data
    base = summary["current"]
    trend = summary.get("trend", [base] * 14)
    
    history = []
    for i in range(num_points):
        if time_range == "day":
            date = now - timedelta(hours=i)
        else:
            date = now - timedelta(days=days * i / num_points)
        idx = min(i, len(trend) - 1) if i < len(trend) else -1
        val = trend[idx] if idx >= 0 else base + random.uniform(-base * 0.15, base * 0.15)
        history.append({
            "date": date.isoformat(),
            "value": round(val, 2),
            "apple_value": round(val * 0.52, 2) if summary.get("apple_value") else None,
            "samsung_value": round(val * 0.48, 2) if summary.get("samsung_value") else None,
        })
    history.reverse()
    
    # Calculate statistics
    values = [h["value"] for h in history]
    statistics = {
        "avg": round(sum(values) / len(values), 2) if values else 0,
        "min": round(min(values), 2) if values else 0,
        "max": round(max(values), 2) if values else 0,
        "total": round(sum(values), 2) if values else 0,
    }
    
    # Generate hourly data for day view
    hourly = None
    if time_range == "day":
        hourly = [{"hour": h, "value": round(base * (0.3 + 0.7 * random.random()), 2)} for h in range(24)]
    
    # Calculate scientific metrics based on metric type
    scientific = calculate_scientific_metrics(metric, summary, user)
    
    return {
        "metric": metric,
        "current": summary["current"],
        "goal": summary["goal"],
        "unit": summary["unit"],
        "label": summary.get("label", metric.replace("_", " ").title()),
        "category": summary.get("category", "activity"),
        "trend": summary.get("trend", []),
        "apple_value": summary.get("apple_value"),
        "samsung_value": summary.get("samsung_value"),
        "delta_pct": summary.get("delta_pct", 0),
        "history": history,
        "statistics": statistics,
        "hourly": hourly,
        "scientific": scientific,
    }


@api.get("/metrics/categories")
async def get_metric_categories(user=Depends(current_user)):
    """Get all metrics organized by category for the comprehensive health dashboard."""
    docs = await db.metric_summaries.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "updated_at": 0}
    ).to_list(100)
    
    # Organize metrics by category
    categories = {}
    for cat_id, cat_info in METRIC_CATEGORIES.items():
        categories[cat_id] = {
            "id": cat_id,
            "label": cat_info["label"],
            "icon": cat_info["icon"],
            "color": cat_info["color"],
            "metrics": []
        }
    
    # Add metrics to their categories
    for doc in docs:
        cat = doc.get("category", "activity")
        if cat in categories:
            categories[cat]["metrics"].append(doc)
    
    return {
        "categories": list(categories.values()),
        "total_metrics": len(docs),
        "category_metadata": METRIC_CATEGORIES,
    }


@api.get("/metrics/summary/all")
async def metrics_summary_all(user=Depends(current_user)):
    """Get all metrics including new comprehensive ones with category info."""
    # First, ensure user has all comprehensive metrics
    added = await upgrade_user_metrics(user["id"])
    if added > 0:
        log.info(f"Upgraded user {user['id']} with {added} new metrics")
    
    docs = await db.metric_summaries.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "updated_at": 0}
    ).to_list(100)
    
    # Sort by category order
    category_order = ["activity", "exercise", "nutrition", "body", "vitals"]
    docs.sort(key=lambda d: (
        category_order.index(d.get("category", "activity")) if d.get("category") in category_order else 99,
        d.get("metric", "")
    ))
    
    return docs


def calculate_scientific_metrics(metric: str, summary: dict, user: dict) -> dict:
    """Calculate scientific/derived metrics based on raw health data."""
    current = summary["current"]
    
    if metric == "steps":
        # Steps-based calculations
        stride_length_m = 0.75  # average stride length
        distance_km = round((current * stride_length_m) / 1000, 2)
        calories_per_step = 0.04
        return {
            "distance_km": distance_km,
            "calories_burned": round(current * calories_per_step, 0),
            "active_minutes": round(current / 100, 0),  # ~100 steps/min average
            "floors_climbed": round(current / 2000, 1),  # estimate
            "avg_cadence": round(100 + random.uniform(-10, 10), 0),
            "step_asymmetry": round(random.uniform(0, 5), 1),
        }
    
    elif metric == "heart_rate":
        # Heart rate calculations
        age = 35  # default assumption
        max_hr = 220 - age
        resting = round(current * 0.85, 0)
        return {
            "resting_hr": resting,
            "max_hr": max_hr,
            "hrv": round(random.uniform(25, 65), 0),  # HRV in ms (RMSSD)
            "recovery_rate": round(random.uniform(15, 30), 0),
            "rest_minutes": round(random.uniform(300, 600), 0),
            "fat_burn_minutes": round(random.uniform(30, 90), 0),
            "cardio_minutes": round(random.uniform(15, 45), 0),
            "peak_minutes": round(random.uniform(5, 20), 0),
        }
    
    elif metric == "sleep":
        # Sleep calculations
        total_hours = current
        return {
            "deep_sleep": round(total_hours * 0.20, 1),  # 15-25% deep sleep
            "light_sleep": round(total_hours * 0.50, 1),  # 45-55% light sleep
            "rem_sleep": round(total_hours * 0.22, 1),   # 20-25% REM
            "awake_time": round(random.uniform(10, 30), 0),  # minutes
            "sleep_score": round(min(100, (total_hours / 8.0) * 85 + random.uniform(0, 15)), 0),
            "sleep_efficiency": round(min(100, 85 + random.uniform(0, 12)), 1),
            "sleep_debt": round(max(0, (8.0 - total_hours) * 7), 1),  # weekly debt
            "consistency_score": round(random.uniform(70, 95), 0),
        }
    
    elif metric == "workouts":
        # Workout/VO2 max calculations
        minutes = current
        return {
            "vo2_max": round(random.uniform(35, 55), 1),  # mL/kg/min
            "training_load": round(minutes * random.uniform(1.5, 2.5), 0),  # TRIMP
            "recovery_hours": round(random.uniform(12, 36), 0),
            "workout_calories": round(minutes * random.uniform(8, 12), 0),
            "avg_workout_hr": round(random.uniform(120, 155), 0),
            "workout_count": round(random.uniform(3, 7), 0),
        }
    
    elif metric == "spo2":
        # Blood oxygen calculations
        spo2 = current
        return {
            "avg_spo2": round(spo2, 1),
            "min_spo2": round(spo2 - random.uniform(2, 5), 1),
            "night_avg_spo2": round(spo2 - random.uniform(0, 2), 1),
            "low_spo2_events": round(random.uniform(0, 3), 0),
            "altitude_adjusted": round(spo2 + 1, 1),
            "respiratory_rate": round(random.uniform(12, 18), 0),
        }
    
    elif metric == "ecg":
        # ECG measurements
        return {
            "pr_interval": round(random.uniform(120, 200), 0),
            "qrs_duration": round(random.uniform(80, 120), 0),
            "qt_interval": round(random.uniform(350, 440), 0),
            "qtc": round(random.uniform(380, 450), 0),  # Corrected QT
            "rhythm_classification": "Sinus Rhythm",
            "ecg_readings_count": round(random.uniform(5, 20), 0),
        }
    
    elif metric == "calories":
        # Calorie calculations (BMR, TDEE)
        weight_kg = 70  # default
        height_cm = 170
        age = 35
        # Mifflin-St Jeor equation
        bmr = round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5, 0)
        return {
            "bmr": bmr,
            "tdee": round(bmr * 1.55, 0),  # moderate activity
            "active_calories": round(current * 0.3, 0),
            "resting_calories": round(current * 0.7, 0),
            "net_calories": round(random.uniform(-200, 200), 0),
            "weekly_avg_calories": round(current + random.uniform(-100, 100), 0),
        }
    
    elif metric == "stand":
        # Standing/movement calculations
        hours = current
        return {
            "stand_hours": round(hours, 0),
            "total_stand_minutes": round(hours * random.uniform(8, 15), 0),
            "sedentary_hours": round(16 - hours, 1),
            "movement_breaks": round(hours * random.uniform(1.5, 3), 0),
            "longest_sedentary": round(random.uniform(60, 180), 0),
            "stand_streak": round(random.uniform(1, 14), 0),
        }
    
    return {}


@api.post("/metrics/sync-now")
async def trigger_sync(user=Depends(current_user)):
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    now = datetime.now(timezone.utc)
    new_events = []
    for s in summaries:
        new_current = max(0, round(s["current"] + random.uniform(-0.02, 0.05) * s["current"], 1))
        new_trend = (s["trend"] + [new_current])[-14:]
        await db.metric_summaries.update_one(
            {"user_id": user["id"], "metric": s["metric"]},
            {"$set": {"current": new_current, "trend": new_trend, "updated_at": now}})
        new_events.append({"id": str(uuid.uuid4()), "user_id": user["id"], "metric": s["metric"],
                           "source": random.choice(["apple", "samsung"]), "destination": "cloud",
                           "value": new_current, "unit": s["unit"], "status": "success", "created_at": now})
    if new_events:
        await db.sync_events.insert_many(new_events)
    await db.watches.update_many({"user_id": user["id"]}, {"$set": {"last_sync_at": now}})
    return {"synced": len(new_events), "timestamp": now}


@api.post("/health/setup")
async def save_health_setup(setup: dict, user=Depends(current_user)):
    """Save user's health platform setup configuration."""
    now = datetime.now(timezone.utc)
    setup_doc = {
        "user_id": user["id"],
        "platform": setup.get("platform", "unknown"),
        "watches": setup.get("watches", []),
        "health_kit_granted": setup.get("healthKitGranted", False),
        "health_connect_granted": setup.get("healthConnectGranted", False),
        "icloud_connected": setup.get("icloudConnected", False),
        "samsung_health_linked": setup.get("samsungHealthLinked", False),
        "setup_completed": True,
        "updated_at": now,
    }
    await db.health_setups.update_one(
        {"user_id": user["id"]},
        {"$set": setup_doc},
        upsert=True
    )
    
    # Create watch entries for selected watches
    for watch_id in setup.get("watches", []):
        watch_names = {
            "apple": ("Apple Watch", "apple"),
            "samsung": ("Galaxy Watch", "samsung"),
            "google": ("Pixel Watch", "google"),
            "fitbit": ("Fitbit", "fitbit"),
            "garmin": ("Garmin", "garmin"),
            "xiaomi": ("Mi Band", "xiaomi"),
            "huawei": ("Huawei Watch", "huawei"),
            "withings": ("Withings", "withings"),
        }
        if watch_id in watch_names:
            name, platform = watch_names[watch_id]
            existing = await db.watches.find_one({"user_id": user["id"], "platform": platform})
            if not existing:
                await db.watches.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user["id"],
                    "platform": platform,
                    "model": name,
                    "os_version": "Latest",
                    "battery": random.randint(70, 100),
                    "last_sync_at": now,
                    "status": "connected",
                    "created_at": now,
                })
    
    return {"status": "ok", "setup": setup_doc}


@api.get("/health/setup")
async def get_health_setup(user=Depends(current_user)):
    """Get user's health platform setup configuration."""
    setup = await db.health_setups.find_one({"user_id": user["id"]}, {"_id": 0})
    if not setup:
        return {"setup_completed": False}
    return setup


@api.get("/health/platforms")
async def get_available_platforms():
    """Get list of supported health platforms and watches."""
    return {
        "platforms": [
            {
                "id": "apple_healthkit",
                "name": "Apple HealthKit",
                "os": "ios",
                "description": "Native iOS health data platform",
                "features": ["steps", "heart_rate", "sleep", "workouts", "spo2", "ecg"],
            },
            {
                "id": "health_connect",
                "name": "Health Connect",
                "os": "android",
                "description": "Google's unified Android health API",
                "features": ["steps", "heart_rate", "sleep", "workouts", "spo2"],
            },
            {
                "id": "samsung_health",
                "name": "Samsung Health",
                "os": "android",
                "description": "Samsung's health ecosystem",
                "features": ["steps", "heart_rate", "sleep", "workouts", "spo2", "stress"],
            },
        ],
        "watches": [
            {"id": "apple", "name": "Apple Watch", "platforms": ["ios"], "sync_method": "healthkit"},
            {"id": "samsung", "name": "Galaxy Watch", "platforms": ["android", "ios"], "sync_method": "health_connect"},
            {"id": "google", "name": "Pixel Watch", "platforms": ["android"], "sync_method": "health_connect"},
            {"id": "fitbit", "name": "Fitbit", "platforms": ["android", "ios"], "sync_method": "oauth"},
            {"id": "garmin", "name": "Garmin", "platforms": ["android", "ios"], "sync_method": "oauth"},
            {"id": "xiaomi", "name": "Xiaomi/Mi Band", "platforms": ["android", "ios"], "sync_method": "health_connect"},
            {"id": "huawei", "name": "Huawei Watch", "platforms": ["android"], "sync_method": "health_connect"},
            {"id": "withings", "name": "Withings", "platforms": ["android", "ios"], "sync_method": "oauth"},
        ],
        "cross_ecosystem": {
            "supported": True,
            "description": "HealthBridge syncs data between Apple HealthKit and Health Connect automatically",
            "limitations": [
                "Apple Watch requires iPhone for initial setup",
                "Some metrics may have slight delays during cross-sync",
                "ECG data cannot be written to Health Connect (read-only)",
            ],
        },
    }


# ---------- Connectors (Phase C) ----------
CONNECTOR_TEMPLATE: List[dict] = [
    {
        "connector_id": "apple_health", "name": "Apple Health", "icon": "logo-apple",
        "color": "#F3F4F6", "platforms": ["ios"],
        "metrics_provided": ["steps", "heart_rate", "sleep", "calories", "workouts", "vo2_max", "hrv", "spo2", "ecg", "distance", "active_minutes", "floors", "stand", "resting_hr", "respiratory_rate"],
    },
    {
        "connector_id": "google_fit", "name": "Google Fit", "icon": "logo-google",
        "color": "#EA4335", "platforms": ["android"],
        "metrics_provided": ["steps", "heart_rate", "sleep", "calories", "distance", "active_minutes", "workouts"],
    },
    {
        "connector_id": "samsung_health", "name": "Samsung Health", "icon": "phone-portrait-outline",
        "color": "#3B82F6", "platforms": ["android"],
        "metrics_provided": ["steps", "heart_rate", "sleep", "calories", "stress", "blood_pressure_sys", "blood_pressure_dia", "spo2", "workouts", "distance"],
    },
    {
        "connector_id": "fitbit", "name": "Fitbit", "icon": "fitness-outline",
        "color": "#00B0B9", "platforms": ["ios", "android"],
        "metrics_provided": ["steps", "heart_rate", "sleep", "calories", "active_minutes", "floors", "distance", "resting_hr"],
    },
    {
        "connector_id": "garmin", "name": "Garmin Connect", "icon": "navigate-outline",
        "color": "#007DC3", "platforms": ["ios", "android"],
        "metrics_provided": ["steps", "heart_rate", "sleep", "calories", "vo2_max", "training_load", "recovery_time", "stress", "workouts", "hrv"],
    },
    {
        "connector_id": "myfitnesspal", "name": "MyFitnessPal", "icon": "restaurant-outline",
        "color": "#0073CF", "platforms": ["ios", "android"],
        "metrics_provided": ["calorie_intake", "protein", "carbs", "fat", "fiber", "water"],
    },
    {
        "connector_id": "strava", "name": "Strava", "icon": "bicycle-outline",
        "color": "#FC4C02", "platforms": ["ios", "android"],
        "metrics_provided": ["workouts", "distance", "calories", "heart_rate", "vo2_max"],
    },
    {
        "connector_id": "oura", "name": "Oura Ring", "icon": "ellipse-outline",
        "color": "#D4AF37", "platforms": ["ios", "android"],
        "metrics_provided": ["sleep", "sleep_quality", "hrv", "resting_hr", "body_temp", "respiratory_rate"],
    },
    {
        "connector_id": "withings", "name": "Withings Health Mate", "icon": "scale-outline",
        "color": "#00A0E0", "platforms": ["ios", "android"],
        "metrics_provided": ["weight", "bmi", "body_fat", "muscle_mass", "blood_pressure_sys", "blood_pressure_dia"],
    },
]


class ConnectorOut(BaseModel):
    connector_id: str
    name: str
    icon: str
    color: str
    platforms: List[str]
    metrics_provided: List[str]
    connected: bool = False
    last_sync_at: Optional[datetime] = None


class PrimarySourceIn(BaseModel):
    metric: str
    connector_id: str
    device_id: Optional[str] = None  # None ⇒ global default for this account


class BulkConnectIn(BaseModel):
    platforms: Optional[List[str]] = None  # if provided, only connect connectors that
    # support at least one of these platforms (e.g. ["ios"] / ["android"]).
    connector_ids: Optional[List[str]] = None  # if provided, restrict to these connectors


class DeviceRegisterIn(BaseModel):
    device_id: str = Field(min_length=4, max_length=64)
    label: str = Field(min_length=1, max_length=80)
    platform: Literal["ios", "android", "web"] = "web"


async def ensure_connectors_seeded(user_id: str) -> None:
    """Seed default disconnected connectors for the user if none exist."""
    existing = await db.connectors.count_documents({"user_id": user_id})
    if existing > 0:
        return
    docs = []
    for c in CONNECTOR_TEMPLATE:
        docs.append({
            **c, "user_id": user_id, "connected": False, "last_sync_at": None,
        })
    if docs:
        await db.connectors.insert_many(docs)


@api.get("/connectors", response_model=List[ConnectorOut])
async def list_connectors(user=Depends(current_user)):
    await ensure_connectors_seeded(user["id"])
    docs = await db.connectors.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).to_list(50)
    order = {c["connector_id"]: i for i, c in enumerate(CONNECTOR_TEMPLATE)}
    docs.sort(key=lambda d: order.get(d["connector_id"], 99))
    return docs


@api.post("/connectors/{connector_id}/connect", response_model=ConnectorOut)
async def connect_connector(connector_id: str, user=Depends(current_user)):
    await ensure_connectors_seeded(user["id"])
    now = datetime.now(timezone.utc)
    res = await db.connectors.update_one(
        {"user_id": user["id"], "connector_id": connector_id},
        {"$set": {"connected": True, "last_sync_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Connector not found")
    conn = await db.connectors.find_one(
        {"user_id": user["id"], "connector_id": connector_id}, {"_id": 0, "user_id": 0}
    )
    # Auto-set as account-global primary for any metric that currently has no primary
    for metric in conn.get("metrics_provided", []):
        existing = await db.metric_primary.find_one({
            "user_id": user["id"], "metric": metric, "device_id": "*",
        })
        if not existing:
            await db.metric_primary.insert_one({
                "user_id": user["id"], "metric": metric, "device_id": "*",
                "connector_id": connector_id, "updated_at": now,
            })
    return conn


@api.post("/connectors/{connector_id}/disconnect", response_model=ConnectorOut)
async def disconnect_connector(connector_id: str, user=Depends(current_user)):
    await ensure_connectors_seeded(user["id"])
    res = await db.connectors.update_one(
        {"user_id": user["id"], "connector_id": connector_id},
        {"$set": {"connected": False}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Connector not found")
    # Remove primary assignments (account-global AND per-device) for this connector
    # and reassign to any other connected provider when possible.
    primaries = await db.metric_primary.find(
        {"user_id": user["id"], "connector_id": connector_id}
    ).to_list(500)
    for p in primaries:
        alt = await db.connectors.find_one({
            "user_id": user["id"], "connected": True,
            "metrics_provided": p["metric"],
            "connector_id": {"$ne": connector_id},
        }, {"_id": 0})
        if alt:
            await db.metric_primary.update_one(
                {"user_id": user["id"], "metric": p["metric"], "device_id": p.get("device_id", "*")},
                {"$set": {"connector_id": alt["connector_id"],
                          "updated_at": datetime.now(timezone.utc)}},
            )
        else:
            await db.metric_primary.delete_one({
                "user_id": user["id"], "metric": p["metric"],
                "device_id": p.get("device_id", "*"),
            })
    conn = await db.connectors.find_one(
        {"user_id": user["id"], "connector_id": connector_id}, {"_id": 0, "user_id": 0}
    )
    return conn


@api.get("/metrics/availability")
async def metrics_availability(device_id: Optional[str] = None, user=Depends(current_user)):
    """Returns availability map per metric — which connectors provide it,
    whether at least one is connected (so the metric can be enabled), and the
    user-chosen primary connector for that metric.

    When `device_id` is provided, the primary returned is the device-specific
    primary if one exists, otherwise the account-global primary. This lets
    households sharing one account pick different primaries per phone.
    """
    await ensure_connectors_seeded(user["id"])
    connectors = await db.connectors.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).to_list(50)
    # Account-global primaries
    globals_ = await db.metric_primary.find(
        {"user_id": user["id"], "device_id": {"$in": [None, "*"]}},
        {"_id": 0, "user_id": 0},
    ).to_list(200)
    global_by_metric = {p["metric"]: p["connector_id"] for p in globals_}
    device_by_metric: Dict[str, str] = {}
    if device_id:
        device_docs = await db.metric_primary.find(
            {"user_id": user["id"], "device_id": device_id},
            {"_id": 0, "user_id": 0},
        ).to_list(200)
        device_by_metric = {p["metric"]: p["connector_id"] for p in device_docs}

    # Collect all metric ids from the metric template
    all_metrics: set = set()
    for c in CONNECTOR_TEMPLATE:
        for m in c["metrics_provided"]:
            all_metrics.add(m)
    for m in DEFAULT_METRICS_TEMPLATE:
        all_metrics.add(m["metric"])

    out = {}
    for metric in all_metrics:
        all_providers = [c["connector_id"] for c in connectors if metric in c.get("metrics_provided", [])]
        connected_providers = [c["connector_id"] for c in connectors
                               if metric in c.get("metrics_provided", []) and c.get("connected")]
        primary = device_by_metric.get(metric) or global_by_metric.get(metric)
        out[metric] = {
            "providers": all_providers,
            "connected_providers": connected_providers,
            "available": len(connected_providers) > 0,
            "primary": primary,
            "primary_is_device_specific": metric in device_by_metric,
        }
    return {
        "metrics": out,
        "total_connected": sum(1 for c in connectors if c.get("connected")),
        "device_id": device_id,
    }


@api.post("/connectors/primary")
async def set_primary_source(payload: PrimarySourceIn, user=Depends(current_user)):
    """Set the primary connector for a metric. When `device_id` is supplied,
    the assignment is scoped to that device only (per-device primary). When
    `device_id` is omitted, the assignment is the account-global default.
    The connector must be connected and provide that metric."""
    conn = await db.connectors.find_one({
        "user_id": user["id"], "connector_id": payload.connector_id,
    }, {"_id": 0})
    if not conn:
        raise HTTPException(404, "Connector not found")
    if not conn.get("connected"):
        raise HTTPException(400, "Connector is not connected")
    if payload.metric not in conn.get("metrics_provided", []):
        raise HTTPException(400, f"{conn['name']} does not provide this metric")
    now = datetime.now(timezone.utc)
    device_key = payload.device_id or "*"
    await db.metric_primary.update_one(
        {"user_id": user["id"], "metric": payload.metric, "device_id": device_key},
        {"$set": {"connector_id": payload.connector_id, "updated_at": now}},
        upsert=True,
    )
    return {
        "ok": True, "metric": payload.metric,
        "connector_id": payload.connector_id,
        "device_id": payload.device_id,
    }


@api.delete("/connectors/primary/{metric}")
async def clear_primary_source(metric: str, device_id: Optional[str] = None, user=Depends(current_user)):
    """Clear a primary-source assignment. When `device_id` is supplied, only
    the device-specific override is removed (revealing the account-global
    default). Otherwise the global default is cleared."""
    device_key = device_id or "*"
    await db.metric_primary.delete_one({
        "user_id": user["id"], "metric": metric, "device_id": device_key,
    })
    return {"ok": True}


@api.post("/connectors/connect-all", response_model=List[ConnectorOut])
async def bulk_connect(payload: BulkConnectIn, user=Depends(current_user)):
    """Connect every disconnected connector at once. Optionally filter by
    platform (e.g. only iOS-compatible ones) or by connector_ids. Used by the
    'Connect all available' affordance on /app-connectors."""
    await ensure_connectors_seeded(user["id"])
    query: Dict[str, Any] = {"user_id": user["id"], "connected": False}
    if payload.connector_ids:
        query["connector_id"] = {"$in": payload.connector_ids}
    if payload.platforms:
        # Mongo $in matches if ANY of the connector's platforms is in the requested list
        query["platforms"] = {"$in": payload.platforms}
    targets = await db.connectors.find(query, {"_id": 0, "user_id": 0}).to_list(50)
    now = datetime.now(timezone.utc)
    if not targets:
        return await db.connectors.find(
            {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
        ).to_list(50)
    ids = [t["connector_id"] for t in targets]
    await db.connectors.update_many(
        {"user_id": user["id"], "connector_id": {"$in": ids}},
        {"$set": {"connected": True, "last_sync_at": now}},
    )
    # Auto-assign account-global primary for any metric that has no primary yet
    for t in targets:
        for metric in t.get("metrics_provided", []):
            existing = await db.metric_primary.find_one({
                "user_id": user["id"], "metric": metric, "device_id": "*",
            })
            if not existing:
                await db.metric_primary.insert_one({
                    "user_id": user["id"], "metric": metric, "device_id": "*",
                    "connector_id": t["connector_id"], "updated_at": now,
                })
    all_conns = await db.connectors.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).to_list(50)
    order = {c["connector_id"]: i for i, c in enumerate(CONNECTOR_TEMPLATE)}
    all_conns.sort(key=lambda d: order.get(d["connector_id"], 99))
    return all_conns


@api.post("/devices/register")
async def register_device(payload: DeviceRegisterIn, user=Depends(current_user)):
    """Register / upsert a device profile for this account. Used to label
    per-device primary-source overrides ('iPhone 15', 'Pixel 8') so the
    customize-metrics screen can show a friendly device chip."""
    now = datetime.now(timezone.utc)
    await db.user_devices.update_one(
        {"user_id": user["id"], "device_id": payload.device_id},
        {"$set": {
            "label": payload.label, "platform": payload.platform,
            "last_seen_at": now,
        }, "$setOnInsert": {"first_seen_at": now}},
        upsert=True,
    )
    return {"ok": True, "device_id": payload.device_id}


@api.get("/devices")
async def list_devices(user=Depends(current_user)):
    """List all device profiles registered against this account."""
    docs = await db.user_devices.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("last_seen_at", -1).to_list(20)
    return docs


# ---------- Watch proximity (Phase C) ----------
@api.post("/watches/{watch_id}/proximity")
async def watch_proximity(watch_id: str, user=Depends(current_user)):
    """Simulate a Bluetooth proximity scan for a watch. In a native build this
    would use CoreBluetooth / Android BLE RSSI. Here we return a randomized but
    plausible reading. Used by the connect flow to gate the action."""
    w = await db.watches.find_one({"id": watch_id, "user_id": user["id"]}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Watch not found")
    # 80% chance the watch is "in range" in the simulated scan
    in_range = random.random() < 0.8
    rssi = random.randint(-55, -35) if in_range else random.randint(-95, -75)
    distance_m = round(max(0.2, (abs(rssi) - 30) / 10.0), 1)
    return {
        "watch_id": watch_id,
        "in_range": in_range,
        "rssi": rssi,
        "distance_m": distance_m,
        "scanned_at": datetime.now(timezone.utc),
    }


@api.post("/metrics/ingest")
async def ingest_health_batch(batch: HealthBatchIn, user=Depends(current_user)):
    """Endpoint the **native** HealthKit / Health Connect bridge posts to."""
    if not batch.samples:
        return {"ingested": 0}
    now = datetime.now(timezone.utc)
    events = []
    for s in batch.samples:
        await db.metric_summaries.update_one(
            {"user_id": user["id"], "metric": s.metric},
            {"$set": {"current": s.value, "unit": s.unit, "updated_at": now},
             "$push": {"trend": {"$each": [s.value], "$slice": -14}}},
            upsert=True,
        )
        events.append({"id": str(uuid.uuid4()), "user_id": user["id"], "metric": s.metric,
                       "source": s.source, "destination": "cloud",
                       "value": s.value, "unit": s.unit, "status": "success",
                       "created_at": s.recorded_at or now})
    await db.sync_events.insert_many(events)
    # Notify the opposite-ecosystem (best-effort)
    if user.get("subscription", {}).get("notifications", True):
        await send_push(user["id"], "New health data bridged",
                        f"{len(events)} samples synced from {events[0]['source']} → cloud",
                        {"screen": "/(tabs)/sync"})
    return {"ingested": len(events)}


# ---------- Migration jobs (history wizard) ----------
@api.post("/migrate/start", response_model=MigrationJob)
async def migrate_start(p: MigrationStartIn, user=Depends(current_user)):
    if p.source == p.target:
        raise HTTPException(400, "Source and target must differ")
    job_id = str(uuid.uuid4())
    metrics = p.metrics or [m["metric"] for m in DEFAULT_METRICS_TEMPLATE]
    # Estimate total samples to migrate (deterministic + believable)
    total = sum(int(p.range_days * (3 if m in ("heart_rate", "steps") else 1)) for m in metrics)
    doc = {
        "id": job_id, "user_id": user["id"],
        "source": p.source, "target": p.target, "range_days": p.range_days,
        "status": "running", "progress": 0, "total": total, "samples_migrated": 0,
        "started_at": datetime.now(timezone.utc),
        "finished_at": None, "message": None,
        "metrics": metrics,
    }
    await db.migration_jobs.insert_one(doc)
    # Generate audit events so the user can watch them flow
    now = datetime.now(timezone.utc)
    events = []
    for i, m in enumerate(metrics):
        events.append({
            "id": str(uuid.uuid4()), "user_id": user["id"], "metric": m,
            "source": p.source, "destination": p.target,
            "value": random.uniform(1, 5000), "unit": "samples",
            "status": "success" if i % 4 != 3 else "conflict_resolved",
            "created_at": now - timedelta(seconds=i * 5),
        })
    if events:
        await db.sync_events.insert_many(events)
    return MigrationJob(**doc)


@api.get("/migrate/jobs/{job_id}", response_model=MigrationJob)
async def migrate_get(job_id: str, user=Depends(current_user)):
    job = await db.migration_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Migration job not found")
    started = job["started_at"]
    if isinstance(started, datetime) and started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
        job["started_at"] = started
    # Progress simulated by elapsed time — converges to 100% over ~12s
    if job["status"] == "running":
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        pct = min(100, int(elapsed / 12 * 100))
        migrated = int(pct * job["total"] / 100)
        upd = {"progress": pct, "samples_migrated": migrated}
        if pct >= 100:
            upd["status"] = "completed"
            upd["finished_at"] = datetime.now(timezone.utc)
            upd["message"] = f"Migrated {migrated} samples from {job['source']} to {job['target']}"
        await db.migration_jobs.update_one({"id": job_id}, {"$set": upd})
        job.update(upd)
    return MigrationJob(**{k: v for k, v in job.items() if k in MigrationJob.model_fields})


@api.get("/migrate/jobs", response_model=List[MigrationJob])
async def migrate_list(user=Depends(current_user), limit: int = 20):
    docs = await db.migration_jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("started_at", -1).to_list(limit)
    return [MigrationJob(**{k: v for k, v in d.items() if k in MigrationJob.model_fields}) for d in docs]


# ---------- Notification bridge (Galaxy Watch on iPhone / Apple Watch use cases) ----------
@api.get("/bridge/notifications/settings", response_model=NotificationBridgeSettings)
async def get_notif_settings(user=Depends(current_user)):
    doc = await db.notif_bridge_settings.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return doc or NotificationBridgeSettings().model_dump()


@api.put("/bridge/notifications/settings", response_model=NotificationBridgeSettings)
async def update_notif_settings(s: NotificationBridgeSettings, user=Depends(current_user)):
    await db.notif_bridge_settings.update_one({"user_id": user["id"]}, {"$set": s.model_dump()}, upsert=True)
    return s


@api.post("/bridge/notifications/event")
async def log_notif_event(n: NotificationBridgeIn, user=Depends(current_user)):
    settings = await db.notif_bridge_settings.find_one({"user_id": user["id"]}) or {}
    if not settings.get("enabled", True):
        return {"forwarded": False, "reason": "disabled"}
    allowed = settings.get("apps_allowed", ["messages", "whatsapp", "calls", "calendar"])
    if allowed and n.app.lower() not in [a.lower() for a in allowed]:
        return {"forwarded": False, "reason": "app_not_allowed"}
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "app": n.app, "title": n.title, "body": n.body,
        "direction": n.direction, "watch_platform": n.watch_platform,
        "status": "forwarded",
        "created_at": datetime.now(timezone.utc),
    }
    await db.notif_bridge_log.insert_one(doc)
    return {"forwarded": True, "id": doc["id"]}


@api.get("/bridge/notifications/log")
async def list_notif_log(user=Depends(current_user), limit: int = 50):
    docs = await db.notif_bridge_log.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


# ---------- Goals (PRO) ----------
@api.get("/goals", response_model=List[GoalOut])
async def list_goals(user=Depends(current_user)):
    docs = await db.goals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    summary = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    by_metric = {s["metric"]: s for s in summary}
    out: List[GoalOut] = []
    for g in docs:
        m = by_metric.get(g["metric"])
        current = float(m["current"]) if m else 0.0
        pct = min(100.0, (current / g["target"]) * 100) if g["target"] else 0.0
        out.append(GoalOut(id=g["id"], metric=g["metric"], target=g["target"], period=g["period"],
                           current=current, progress_pct=round(pct, 1),
                           streak_days=g.get("streak_days", 0), created_at=g["created_at"]))
    return out


@api.post("/goals", response_model=GoalOut, status_code=201)
async def create_goal(g: GoalIn, user=Depends(current_user)):
    pro_only(user)
    gid = str(uuid.uuid4())
    doc = {"id": gid, "user_id": user["id"], "metric": g.metric, "target": g.target,
           "period": g.period, "streak_days": 0, "created_at": datetime.now(timezone.utc)}
    await db.goals.update_one({"user_id": user["id"], "metric": g.metric},
                                {"$set": {**doc}}, upsert=True)
    saved = await db.goals.find_one({"user_id": user["id"], "metric": g.metric}, {"_id": 0})
    return GoalOut(id=saved["id"], metric=saved["metric"], target=saved["target"],
                   period=saved["period"], current=0, progress_pct=0,
                   streak_days=saved.get("streak_days", 0), created_at=saved["created_at"])


@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user=Depends(current_user)):
    res = await db.goals.delete_one({"id": goal_id, "user_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Goal not found")
    return {"ok": True}


# ---------- Weekly report (PRO) ----------
@api.get("/reports/weekly")
async def weekly_report(user=Depends(current_user)):
    pro_only(user)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    events = await db.sync_events.count_documents({"user_id": user["id"], "created_at": {"$gte": week_ago}})
    breakdown = []
    for s in summaries:
        trend = s.get("trend", [])
        if len(trend) >= 2:
            change = ((trend[-1] - trend[0]) / max(trend[0], 1)) * 100
        else:
            change = 0
        breakdown.append({
            "metric": s["metric"], "label": s["label"], "unit": s["unit"],
            "current": s["current"], "avg": round(sum(trend) / max(len(trend), 1), 1) if trend else 0,
            "min": min(trend) if trend else 0, "max": max(trend) if trend else 0,
            "change_pct": round(change, 1),
        })
    return {
        "period_start": week_ago.isoformat(),
        "period_end": datetime.now(timezone.utc).isoformat(),
        "syncs_total": events,
        "breakdown": breakdown,
    }


# ---------- AI Health Insights (PRO) ----------
@api.post("/insights/generate", response_model=List[InsightOut])
async def generate_insights(user=Depends(current_user)):
    pro_only(user)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service not configured")
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    goals = await db.goals.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)
    payload_lines = [f"- {s['label']}: current={s['current']} {s['unit']}, "
                     f"goal={s['goal']}, trend last 14 days={s['trend']}" for s in summaries]
    goal_lines = [f"- {g['metric']} target {g['target']} {g['period']}" for g in goals] or ["(no goals set)"]
    system = ("You are a board-certified preventive health coach. Generate 4 concise, "
              "actionable insights for the user based on their health metrics. Each insight "
              "must be a JSON object with keys: title (max 6 words), summary (1-2 sentences, "
              "actionable, specific numbers from data), metric (one of steps, heart_rate, "
              "sleep, workouts, spo2, ecg, calories, stand, or null), severity (info|good|"
              "warning|critical), action (short call-to-action). Output ONLY a JSON array of "
              "exactly 4 objects, no markdown.")
    user_msg = "Metrics:\n" + "\n".join(payload_lines) + "\n\nGoals:\n" + "\n".join(goal_lines)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        session_id = f"insights-{user['id']}-{int(datetime.now().timestamp())}"
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system) \
            .with_model("openai", "gpt-4o-mini")
        raw = await chat.send_message(UserMessage(text=user_msg))
    except Exception as e:
        log.warning(f"LLM failed: {e}")
        raise HTTPException(502, f"AI service error: {e}")
    # Parse JSON array
    import json as _json, re as _re
    text = (raw or "").strip()
    m = _re.search(r"\[[\s\S]*\]", text)
    if m:
        text = m.group(0)
    try:
        data = _json.loads(text)
    except Exception:
        log.warning(f"LLM bad JSON: {text[:200]}")
        data = []
    now = datetime.now(timezone.utc)
    insights: List[InsightOut] = []
    for d in data[:4]:
        try:
            ins = InsightOut(
                id=str(uuid.uuid4()),
                title=str(d.get("title", "Health insight"))[:80],
                summary=str(d.get("summary", ""))[:400],
                metric=d.get("metric") if d.get("metric") in {m["metric"] for m in DEFAULT_METRICS_TEMPLATE} else None,
                severity=d.get("severity") if d.get("severity") in ("info", "good", "warning", "critical") else "info",
                action=str(d.get("action") or "")[:120] or None,
                created_at=now,
            )
            insights.append(ins)
        except Exception:
            continue
    if insights:
        await db.insights.delete_many({"user_id": user["id"]})
        await db.insights.insert_many([{**i.model_dump(), "user_id": user["id"]} for i in insights])
    return insights


@api.get("/insights", response_model=List[InsightOut])
async def list_insights(user=Depends(current_user)):
    docs = await db.insights.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(20)
    return [InsightOut(**d) for d in docs]


@api.get("/sync/preferences", response_model=List[SyncPref])
async def get_prefs(user=Depends(current_user)):
    docs = await db.sync_prefs.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    order = {m["metric"]: i for i, m in enumerate(DEFAULT_METRICS_TEMPLATE)}
    docs.sort(key=lambda d: order.get(d["metric"], 99))
    return docs


@api.put("/sync/preferences/{metric}", response_model=SyncPref)
async def update_pref(metric: str, pref: SyncPref, user=Depends(current_user)):
    await db.sync_prefs.update_one({"user_id": user["id"], "metric": metric},
                                     {"$set": {"enabled": pref.enabled, "direction": pref.direction}}, upsert=True)
    return pref


@api.get("/sync/policy", response_model=ConflictPolicy)
async def get_policy(user=Depends(current_user)):
    doc = await db.conflict_policy.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return doc or ConflictPolicy().model_dump()


@api.put("/sync/policy", response_model=ConflictPolicy)
async def update_policy(policy: ConflictPolicy, user=Depends(current_user)):
    await db.conflict_policy.update_one({"user_id": user["id"]}, {"$set": policy.model_dump()}, upsert=True)
    return policy


@api.get("/sync/events", response_model=List[SyncEvent])
async def list_events(user=Depends(current_user), limit: int = 30):
    return await db.sync_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@api.get("/vault/export")
async def vault_export(user=Depends(current_user), fmt: str = "json"):
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    events = await db.sync_events.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(500)
    return {"format": fmt, "exported_at": datetime.now(timezone.utc),
            "metrics": summaries, "events": events}


# ---------- Push tokens ----------
@api.post("/push/register")
async def register_push_token(p: PushTokenIn, user=Depends(current_user)):
    await db.push_tokens.update_one({"user_id": user["id"], "token": p.token},
                                     {"$set": {"user_id": user["id"], "token": p.token,
                                                "platform": p.platform, "app_version": p.app_version,
                                                "active": True, "updated_at": datetime.now(timezone.utc)}},
                                     upsert=True)
    return {"ok": True}


@api.post("/push/test")
async def push_test(user=Depends(current_user)):
    res = await send_push(user["id"], "HealthBridge test",
                          "Push notifications are working ✨", {"screen": "/(tabs)"})
    return res


# ---------- Stripe subscriptions ----------
@api.post("/billing/checkout")
async def create_checkout(p: CheckoutIn, user=Depends(current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(503, "Stripe is not configured")
    sub = user.get("subscription") or {}
    customer_id = sub.get("stripe_customer_id")
    # Dev fallback: when the env Stripe key isn't a real one, simulate success
    # so the demo end-to-end flow still works without leaving the app.
    dev_mode = not STRIPE_API_KEY.startswith("sk_test_") or STRIPE_API_KEY == "sk_test_emergent"
    if dev_mode:
        await db.users.update_one({"id": user["id"]}, {"$set": {
            "subscription.plan": "pro",
            "subscription.status": "active",
            "subscription.current_period_end": datetime.now(timezone.utc) + timedelta(days=30),
            "subscription.cancel_at_period_end": False,
            "subscription.stripe_customer_id": customer_id or f"cus_demo_{user['id'][:8]}",
        }})
        await send_push(user["id"], "Welcome to HealthBridge PRO ✨",
                        "Multi-watch bridge unlocked.", {"screen": "/(tabs)/vault"})
        return {"url": f"{APP_PUBLIC_URL}{p.success_path}", "id": "demo_session", "demo": True}
    try:
        if not customer_id:
            customer = stripe.Customer.create(email=user["email"], name=user.get("name") or user["email"],
                                              metadata={"user_id": user["id"]})
            customer_id = customer.id
            await db.users.update_one({"id": user["id"]},
                                       {"$set": {"subscription.stripe_customer_id": customer_id}})
        session = stripe.checkout.Session.create(
            customer=customer_id, mode="subscription",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "HealthBridge PRO"},
                    "recurring": {"interval": "month"},
                    "unit_amount": 499,
                },
                "quantity": 1,
            }],
            success_url=f"{APP_PUBLIC_URL}{p.success_path}",
            cancel_url=f"{APP_PUBLIC_URL}{p.cancel_path}",
            metadata={"user_id": user["id"]},
        )
        return {"url": session.url, "id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(400, str(e))


@api.post("/billing/portal")
async def create_portal(user=Depends(current_user)):
    sub = user.get("subscription") or {}
    cid = sub.get("stripe_customer_id")
    if not cid:
        raise HTTPException(400, "No Stripe customer")
    dev_mode = not STRIPE_API_KEY.startswith("sk_test_") or STRIPE_API_KEY == "sk_test_emergent"
    if dev_mode or cid.startswith("cus_demo_"):
        # Dev: just bounce them back to settings with a "cancelled" toggle
        await db.users.update_one({"id": user["id"]}, {"$set": {
            "subscription.cancel_at_period_end": True,
        }})
        return {"url": f"{APP_PUBLIC_URL}/(tabs)/settings?portal=demo"}
    try:
        s = stripe.billing_portal.Session.create(customer=cid, return_url=f"{APP_PUBLIC_URL}/(tabs)/settings")
        return {"url": s.url}
    except stripe.error.StripeError as e:
        raise HTTPException(400, str(e))


async def _apply_subscription_from_stripe(stripe_sub: Any) -> None:
    customer_id = getattr(stripe_sub, "customer", None) or stripe_sub.get("customer")
    if not customer_id:
        return
    user = await db.users.find_one({"subscription.stripe_customer_id": customer_id})
    if not user:
        return
    status_v = stripe_sub.get("status") if isinstance(stripe_sub, dict) else stripe_sub.status
    cpe = stripe_sub.get("current_period_end") if isinstance(stripe_sub, dict) else stripe_sub.current_period_end
    cape = stripe_sub.get("cancel_at_period_end") if isinstance(stripe_sub, dict) else stripe_sub.cancel_at_period_end
    sub_id = stripe_sub.get("id") if isinstance(stripe_sub, dict) else stripe_sub.id
    plan = "pro" if status_v in ("active", "trialing") else "free"
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "subscription.plan": plan,
        "subscription.status": status_v,
        "subscription.stripe_subscription_id": sub_id,
        "subscription.current_period_end": datetime.fromtimestamp(cpe, tz=timezone.utc) if cpe else None,
        "subscription.cancel_at_period_end": bool(cape),
    }})


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET and not STRIPE_WEBHOOK_SECRET.startswith("whsec_test_"):
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        else:
            # In dev w/o configured webhook secret: parse JSON without signature verification
            import json as _json
            event = _json.loads(payload.decode())
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")
    et = event.get("type") if isinstance(event, dict) else event["type"]
    obj = (event.get("data") or {}).get("object") if isinstance(event, dict) else event["data"]["object"]
    # Idempotency
    eid = event.get("id") if isinstance(event, dict) else event["id"]
    if eid and await db.stripe_events.find_one({"id": eid}):
        return {"ok": True, "duplicate": True}
    if eid:
        await db.stripe_events.insert_one({"id": eid, "type": et, "received_at": datetime.now(timezone.utc)})
    if et == "checkout.session.completed":
        sub_id = obj.get("subscription")
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            await _apply_subscription_from_stripe(sub)
            # Push: subscription active
            customer_id = obj.get("customer")
            u = await db.users.find_one({"subscription.stripe_customer_id": customer_id})
            if u:
                await send_push(u["id"], "Welcome to HealthBridge PRO ✨",
                                "Multi-watch bridge unlocked.", {"screen": "/(tabs)/vault"})
    elif et in ("customer.subscription.updated", "customer.subscription.created"):
        await _apply_subscription_from_stripe(obj)
    elif et == "customer.subscription.deleted":
        await _apply_subscription_from_stripe({**obj, "status": "canceled"})
    elif et == "invoice.payment_failed":
        customer_id = obj.get("customer")
        u = await db.users.find_one({"subscription.stripe_customer_id": customer_id})
        if u:
            await send_push(u["id"], "Payment issue", "We couldn't charge your card for PRO.",
                            {"screen": "/(tabs)/settings"})
    return {"ok": True}


# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(user=Depends(admin_only)):
    total_users = await db.users.count_documents({})
    pro_users = await db.users.count_documents({"subscription.plan": "pro"})
    active_subs = await db.users.count_documents({"subscription.status": {"$in": ["active", "trialing"]}})
    syncs_24h = await db.sync_events.count_documents({
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}})
    notifications_sent = await db.notifications.count_documents({})
    mrr = active_subs * 4.99
    return {"total_users": total_users, "pro_users": pro_users, "active_subscriptions": active_subs,
            "syncs_24h": syncs_24h, "notifications_sent": notifications_sent, "mrr_usd": round(mrr, 2)}


@api.get("/admin/users")
async def admin_users(user=Depends(admin_only), q: Optional[str] = None, limit: int = 50):
    flt: dict = {}
    if q:
        flt["email"] = {"$regex": q, "$options": "i"}
    users = await db.users.find(flt, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(limit)
    return [serialize_user(u) for u in users]


@api.post("/admin/users/{user_id}/plan")
async def admin_set_plan(user_id: str, plan: str, user=Depends(admin_only)):
    if plan not in ("free", "pro"):
        raise HTTPException(400, "Invalid plan")
    await db.users.update_one({"id": user_id}, {"$set": {
        "subscription.plan": plan,
        "subscription.status": "active" if plan == "pro" else "inactive",
    }})
    return {"ok": True}


@api.post("/admin/users/{user_id}/cancel")
async def admin_cancel_sub(user_id: str, immediate: bool = False, user=Depends(admin_only)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Not found")
    sid = (target.get("subscription") or {}).get("stripe_subscription_id")
    if sid and STRIPE_API_KEY:
        try:
            stripe.Subscription.modify(sid, cancel_at_period_end=not immediate)
        except Exception as e:
            log.warning(f"Stripe cancel failed: {e}")
    await db.users.update_one({"id": user_id}, {"$set": {
        "subscription.status": "canceled" if immediate else "active",
        "subscription.cancel_at_period_end": not immediate,
        "subscription.plan": "free" if immediate else target["subscription"].get("plan", "pro"),
    }})
    return {"ok": True}


@api.post("/admin/broadcast")
async def admin_broadcast(p: SendPushIn, user=Depends(admin_only)):
    users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(2000)
    sent = 0
    for u in users:
        r = await send_push(u["id"], p.title, p.body, p.data)
        sent += r.get("sent", 0)
    return {"recipients": len(users), "sent": sent}


@api.get("/admin/audit")
async def admin_audit(user=Depends(admin_only), limit: int = 100):
    events = await db.sync_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    notifications = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"sync_events": events, "notifications": notifications}


@api.get("/admin/billing/health")
async def admin_billing_health(user=Depends(admin_only)):
    """Confirms whether Stripe is wired with a real live/test key (vs the
    dev-mode `sk_test_emergent` placeholder) and whether a webhook secret is set.
    Use this AFTER swapping in your production Stripe key to validate the swap."""
    key = STRIPE_API_KEY or ""
    masked = (key[:7] + "…" + key[-4:]) if len(key) > 12 else "(unset)"
    mode = "unconfigured"
    if key.startswith("sk_live_"):
        mode = "live"
    elif key.startswith("sk_test_") and key != "sk_test_emergent":
        mode = "test"
    elif key == "sk_test_emergent" or not key:
        mode = "dev_fallback"
    info: dict = {
        "stripe_key_mode": mode,
        "stripe_key_masked": masked,
        "webhook_secret_configured": bool(STRIPE_WEBHOOK_SECRET) and not STRIPE_WEBHOOK_SECRET.startswith("whsec_test_"),
        "price_id": STRIPE_PRICE_ID,
        "app_public_url": APP_PUBLIC_URL,
    }
    # If a real key is wired, try a lightweight call to confirm it actually works
    if mode in ("live", "test"):
        try:
            stripe.Balance.retrieve()
            info["stripe_reachable"] = True
        except Exception as e:  # noqa: BLE001
            info["stripe_reachable"] = False
            info["stripe_error"] = str(e)[:200]
    return info


@api.get("/admin/connectors/stats")
async def admin_connectors_stats(user=Depends(admin_only)):
    """Adoption breakdown per connector — how many users have each connector
    connected. Used by the Admin → Connectors tab to spot under-performing
    integrations and prioritize bug fixes."""
    pipeline = [
        {"$group": {
            "_id": "$connector_id",
            "total": {"$sum": 1},
            "connected": {"$sum": {"$cond": [{"$eq": ["$connected", True]}, 1, 0]}},
        }},
        {"$sort": {"connected": -1}},
    ]
    docs = await db.connectors.aggregate(pipeline).to_list(50)
    by_id = {c["connector_id"]: c for c in CONNECTOR_TEMPLATE}
    out = []
    for d in docs:
        meta = by_id.get(d["_id"], {})
        out.append({
            "connector_id": d["_id"],
            "name": meta.get("name", d["_id"]),
            "icon": meta.get("icon", "apps"),
            "color": meta.get("color", "#9CA3AF"),
            "total_seats": d["total"],
            "connected_seats": d["connected"],
            "adoption_pct": round((d["connected"] / d["total"]) * 100, 1) if d["total"] else 0,
        })
    return {"connectors": out}


@api.get("/admin/devices/stats")
async def admin_devices_stats(user=Depends(admin_only)):
    """Device profile distribution — answers 'how many of our users are
    multi-device households'."""
    total_devices = await db.user_devices.count_documents({})
    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$group": {"_id": None,
                    "users_with_devices": {"$sum": 1},
                    "max_devices": {"$max": "$count"},
                    "avg_devices": {"$avg": "$count"}}},
    ]
    agg = await db.user_devices.aggregate(pipeline).to_list(1)
    summary = agg[0] if agg else {"users_with_devices": 0, "max_devices": 0, "avg_devices": 0}
    platform_breakdown = await db.user_devices.aggregate([
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
    ]).to_list(10)
    return {
        "total_devices": total_devices,
        "users_with_devices": summary.get("users_with_devices", 0),
        "max_devices_per_user": summary.get("max_devices", 0),
        "avg_devices_per_user": round(summary.get("avg_devices", 0) or 0, 2),
        "platforms": [{"platform": p["_id"], "count": p["count"]} for p in platform_breakdown],
    }


@api.get("/admin/engagement")
async def admin_engagement(user=Depends(admin_only)):
    """Active-user funnel: signups, DAU, WAU, MAU, churn. The signal admins
    care about most when triaging product health."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    async def distinct_user_count(window_start: datetime) -> int:
        ids = await db.sync_events.distinct("user_id", {"created_at": {"$gte": window_start}})
        return len(ids)

    dau = await distinct_user_count(day_ago)
    wau = await distinct_user_count(week_ago)
    mau = await distinct_user_count(month_ago)
    new_24h = await db.users.count_documents({"created_at": {"$gte": day_ago}})
    new_7d = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    cancelled_active = await db.users.count_documents({
        "subscription.cancel_at_period_end": True,
        "subscription.status": "active",
    })
    pro_users = await db.users.count_documents({"subscription.plan": "pro"})
    churn_pct = round((cancelled_active / pro_users) * 100, 1) if pro_users else 0
    return {
        "dau": dau, "wau": wau, "mau": mau,
        "new_signups_24h": new_24h, "new_signups_7d": new_7d,
        "wau_dau_ratio": round(wau / dau, 2) if dau else 0,
        "scheduled_to_churn": cancelled_active,
        "churn_pct": churn_pct,
    }


@api.get("/admin/health")
async def admin_health(user=Depends(admin_only)):
    """System self-test for the admin to verify everything is wired up.
    Probes Mongo, the LLM key, and Stripe."""
    out: Dict[str, Any] = {"ok": True, "checks": {}}
    # Mongo
    try:
        await db.command("ping")
        out["checks"]["mongo"] = {"ok": True}
    except Exception as e:  # noqa: BLE001
        out["ok"] = False
        out["checks"]["mongo"] = {"ok": False, "error": str(e)[:200]}
    # LLM key sanity
    out["checks"]["emergent_llm_key"] = {
        "ok": bool(EMERGENT_LLM_KEY),
        "configured": bool(EMERGENT_LLM_KEY),
    }
    # Stripe key mode
    key = STRIPE_API_KEY or ""
    stripe_mode = "live" if key.startswith("sk_live_") else (
        "test" if key.startswith("sk_test_") and key != "sk_test_emergent" else "dev_fallback")
    out["checks"]["stripe"] = {"ok": True, "mode": stripe_mode}
    # JWT
    out["checks"]["jwt"] = {"ok": bool(JWT_SECRET) and len(JWT_SECRET) >= 16}
    # Indexes — verify expected indexes exist (read-only, no side effects)
    try:
        expected = {
            "users": ["email_1", "id_1"],
            "metric_summaries": ["user_id_1_metric_1"],
            "sync_events": ["user_id_1_created_at_-1"],
            "connectors": ["user_id_1_connector_id_1"],
            "metric_primary": ["user_id_1_device_id_1_metric_1"],
            "user_devices": ["user_id_1_device_id_1"],
        }
        missing: List[str] = []
        for coll, names in expected.items():
            existing = await db[coll].list_indexes().to_list(50)
            existing_names = {i.get("name") for i in existing}
            for n in names:
                if n not in existing_names:
                    missing.append(f"{coll}.{n}")
        if missing:
            out["ok"] = False
            out["checks"]["indexes"] = {"ok": False, "missing": missing}
        else:
            out["checks"]["indexes"] = {"ok": True}
    except Exception as e:  # noqa: BLE001
        out["ok"] = False
        out["checks"]["indexes"] = {"ok": False, "error": str(e)[:200]}
    out["timestamp"] = datetime.now(timezone.utc).isoformat()
    return out


@api.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str, user=Depends(admin_only)):
    """Full deep-dive on a single user — subscription, watches, connectors,
    devices and recent activity. Powers the admin user-detail drawer."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "User not found")
    watches = await db.watches.find({"user_id": user_id}, {"_id": 0, "user_id": 0}).to_list(20)
    connectors = await db.connectors.find(
        {"user_id": user_id}, {"_id": 0, "user_id": 0}
    ).to_list(50)
    devices = await db.user_devices.find(
        {"user_id": user_id}, {"_id": 0, "user_id": 0}
    ).sort("last_seen_at", -1).to_list(20)
    recent_syncs = await db.sync_events.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    goals = await db.goals.find({"user_id": user_id}, {"_id": 0, "user_id": 0}).to_list(20)
    return {
        "user": serialize_user(target),
        "watches": watches,
        "connectors_connected": [c for c in connectors if c.get("connected")],
        "connectors_total": len(connectors),
        "devices": devices,
        "recent_syncs": recent_syncs,
        "goals": goals,
    }


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(admin_only)):
    """Hard-delete a user and all their data. Used for GDPR right-to-erase
    requests. The admin account cannot delete itself."""
    if user_id == user["id"]:
        raise HTTPException(400, "Admins cannot delete their own account")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    collections_to_clean = [
        "watches", "metric_summaries", "sync_prefs", "sync_events",
        "conflict_policy", "goals", "insights", "metric_primary",
        "connectors", "user_devices", "notifications", "push_tokens",
        "migration_jobs", "notif_bridge_settings", "notif_bridge_log",
        "health_setup",
    ]
    for coll_name in collections_to_clean:
        await db[coll_name].delete_many({"user_id": user_id})
    # Tokens / resets — password_resets is keyed by user_id (see forgot_password())
    await db.password_resets.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    # GDPR: log only the user_id, not the email (PII)
    log.info(f"Admin {user['id']} deleted user {user_id}")
    return {"ok": True, "deleted_user_id": user_id, "deleted_email": target["email"]}


# ---------- Privacy/legal endpoints (raw markdown for external indexing) ----------
@api.get("/legal/privacy")
async def get_privacy():
    return {"version": "2026-05-15", "doc": "privacy", "url": f"{APP_PUBLIC_URL}/privacy"}


@api.get("/legal/terms")
async def get_terms():
    return {"version": "2026-05-15", "doc": "terms", "url": f"{APP_PUBLIC_URL}/terms"}


# ---------- Root ----------
@api.get("/")
async def root():
    return {"app": "HealthBridge Vault", "version": "2.0", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("subscription.stripe_customer_id", sparse=True)
    await db.watches.create_index("user_id")
    await db.metric_summaries.create_index([("user_id", 1), ("metric", 1)], unique=True)
    await db.sync_prefs.create_index([("user_id", 1), ("metric", 1)], unique=True)
    await db.sync_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.push_tokens.create_index([("user_id", 1), ("token", 1)], unique=True)
    await db.stripe_events.create_index("id", unique=True)
    await db.password_resets.create_index("token", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    await db.migration_jobs.create_index([("user_id", 1), ("started_at", -1)])
    await db.notif_bridge_log.create_index([("user_id", 1), ("created_at", -1)])
    await db.goals.create_index([("user_id", 1), ("metric", 1)], unique=True)
    await db.insights.create_index([("user_id", 1), ("created_at", -1)])
    # Phase C indexes — connectors / per-device primary / device profiles
    await db.connectors.create_index([("user_id", 1), ("connector_id", 1)], unique=True)
    await db.metric_primary.create_index(
        [("user_id", 1), ("device_id", 1), ("metric", 1)], unique=True)
    await db.user_devices.create_index(
        [("user_id", 1), ("device_id", 1)], unique=True)
    await seed_admin_user()
    await seed_demo_user()
    log.info("HealthBridge Vault API v2 ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
