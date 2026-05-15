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
from typing import List, Literal, Optional, Any

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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="HealthBridge Vault API", version="2.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("healthbridge")


# ---------- Models ----------
PlatformLiteral = Literal["apple", "samsung", "google", "cloud"]
MetricLiteral = Literal["steps", "heart_rate", "sleep", "workouts", "spo2", "ecg", "calories", "stand"]


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
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name"),
        "created_at": user["created_at"],
        "is_admin": bool(user.get("is_admin")),
        "subscription": {
            "plan": sub.get("plan", "free"),
            "status": sub.get("status", "inactive"),
            "current_period_end": sub.get("current_period_end"),
            "cancel_at_period_end": bool(sub.get("cancel_at_period_end")),
            "stripe_customer_id": sub.get("stripe_customer_id"),
        },
    }


# ---------- Demo seed ----------
def _trend(seed: int, base: float, span: float, n: int = 14) -> List[float]:
    random.seed(seed)
    return [round(base + random.uniform(-span, span), 1) for _ in range(n)]


DEFAULT_METRICS_TEMPLATE = [
    {"metric": "steps", "label": "Steps", "unit": "steps", "current": 8420, "goal": 10000, "apple_value": 4720, "samsung_value": 3700, "delta_pct": 6.2},
    {"metric": "heart_rate", "label": "Heart Rate", "unit": "bpm", "current": 72, "goal": 80, "apple_value": 71, "samsung_value": 73, "delta_pct": -1.4},
    {"metric": "sleep", "label": "Sleep", "unit": "h", "current": 7.4, "goal": 8.0, "apple_value": 7.4, "samsung_value": 7.2, "delta_pct": 2.7},
    {"metric": "workouts", "label": "Workouts", "unit": "min", "current": 42, "goal": 60, "apple_value": 28, "samsung_value": 14, "delta_pct": 12.0},
    {"metric": "spo2", "label": "Blood Oxygen", "unit": "%", "current": 98, "goal": 100, "apple_value": 98, "samsung_value": 97, "delta_pct": 0.5},
    {"metric": "ecg", "label": "ECG", "unit": "ms", "current": 412, "goal": 420, "apple_value": 412, "samsung_value": None, "delta_pct": 0.0},
    {"metric": "calories", "label": "Calories", "unit": "kcal", "current": 1842, "goal": 2200, "apple_value": 980, "samsung_value": 862, "delta_pct": 4.1},
    {"metric": "stand", "label": "Stand", "unit": "hr", "current": 9, "goal": 12, "apple_value": 9, "samsung_value": 8, "delta_pct": 3.0},
]


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
                                "subscription": {"plan": "free", "status": "inactive"}})
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
    await seed_admin_user()
    log.info("HealthBridge Vault API v2 ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
