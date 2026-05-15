"""HealthBridge Vault - FastAPI backend.

Provides JWT auth (register/login/me/refresh), connected watch management,
unified health metrics (seeded with realistic demo data), per-metric sync
preferences and an audit log of sync events. All routes are mounted under
/api to match the Kubernetes ingress.
"""
from __future__ import annotations

import os
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status
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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="HealthBridge Vault API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("healthbridge")


# ---------- Models ----------
PlatformLiteral = Literal["apple", "samsung", "google", "cloud"]
MetricLiteral = Literal[
    "steps", "heart_rate", "sleep", "workouts", "spo2", "ecg", "calories", "stand"
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


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    created_at: datetime


class Watch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    platform: PlatformLiteral
    model: str
    battery: int
    connected: bool = True
    last_sync_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MetricSample(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    metric: MetricLiteral
    value: float
    unit: str
    source: PlatformLiteral
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


class SyncPrefsUpdate(BaseModel):
    prefs: List[SyncPref]


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
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        if kind == "access"
        else timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    payload = {"sub": user_id, "type": kind, "iat": now, "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str, kind: Literal["access", "refresh"]) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("type") != kind:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return payload


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token, "access")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ---------- Demo data seed ----------
def _trend(seed: int, base: float, span: float, n: int = 14) -> List[float]:
    random.seed(seed)
    return [round(base + random.uniform(-span, span), 1) for _ in range(n)]


DEFAULT_METRICS_TEMPLATE = [
    {"metric": "steps", "label": "Steps", "unit": "steps", "current": 8420, "goal": 10000,
     "apple_value": 4720, "samsung_value": 3700, "delta_pct": 6.2},
    {"metric": "heart_rate", "label": "Heart Rate", "unit": "bpm", "current": 72, "goal": 80,
     "apple_value": 71, "samsung_value": 73, "delta_pct": -1.4},
    {"metric": "sleep", "label": "Sleep", "unit": "h", "current": 7.4, "goal": 8.0,
     "apple_value": 7.4, "samsung_value": 7.2, "delta_pct": 2.7},
    {"metric": "workouts", "label": "Workouts", "unit": "min", "current": 42, "goal": 60,
     "apple_value": 28, "samsung_value": 14, "delta_pct": 12.0},
    {"metric": "spo2", "label": "Blood Oxygen", "unit": "%", "current": 98, "goal": 100,
     "apple_value": 98, "samsung_value": 97, "delta_pct": 0.5},
    {"metric": "ecg", "label": "ECG", "unit": "ms", "current": 412, "goal": 420,
     "apple_value": 412, "samsung_value": None, "delta_pct": 0.0},
    {"metric": "calories", "label": "Calories", "unit": "kcal", "current": 1842, "goal": 2200,
     "apple_value": 980, "samsung_value": 862, "delta_pct": 4.1},
    {"metric": "stand", "label": "Stand", "unit": "hr", "current": 9, "goal": 12,
     "apple_value": 9, "samsung_value": 8, "delta_pct": 3.0},
]


async def seed_user_data(user_id: str) -> None:
    # Watches
    watches = [
        Watch(user_id=user_id, platform="apple", model="Apple Watch Series 9", battery=82),
        Watch(user_id=user_id, platform="samsung", model="Galaxy Watch 6 Classic", battery=64),
    ]
    await db.watches.insert_many([w.model_dump() for w in watches])

    # Metrics summary
    summaries = []
    for idx, m in enumerate(DEFAULT_METRICS_TEMPLATE):
        summaries.append({
            **m,
            "user_id": user_id,
            "trend": _trend(idx + 1, m["current"], max(m["current"] * 0.08, 1.0)),
            "updated_at": datetime.now(timezone.utc),
        })
    await db.metric_summaries.insert_many(summaries)

    # Sync preferences (all on, bidirectional)
    prefs = [
        {"user_id": user_id, "metric": m["metric"], "enabled": True, "direction": "bidirectional"}
        for m in DEFAULT_METRICS_TEMPLATE
    ]
    await db.sync_prefs.insert_many(prefs)

    # Conflict policy
    await db.conflict_policy.insert_one({
        "user_id": user_id,
        "policy": "latest_wins",
        "background_sync": True,
        "notifications": True,
    })

    # Audit log (recent sync events)
    now = datetime.now(timezone.utc)
    events = []
    pairs = [("apple", "samsung"), ("samsung", "apple"), ("apple", "cloud"), ("samsung", "cloud")]
    for i in range(12):
        src, dst = random.choice(pairs)
        m = random.choice(DEFAULT_METRICS_TEMPLATE)
        events.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "metric": m["metric"],
            "source": src,
            "destination": dst,
            "value": float(m["current"]) + random.uniform(-5, 5),
            "unit": m["unit"],
            "status": random.choice(["success", "success", "success", "conflict_resolved"]),
            "created_at": now - timedelta(minutes=i * 17 + 3),
        })
    await db.sync_events.insert_many(events)


# ---------- Auth routes ----------
@api.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password": hash_pw(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    await seed_user_data(user_id)

    return TokenOut(
        access_token=create_token(user_id, "access"),
        refresh_token=create_token(user_id, "refresh"),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@api.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_pw(payload.password, user["password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(
        access_token=create_token(user["id"], "access"),
        refresh_token=create_token(user["id"], "refresh"),
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@api.post("/auth/refresh", response_model=TokenOut)
async def refresh(payload: RefreshIn):
    data = decode_token(payload.refresh_token, "refresh")
    user = await db.users.find_one({"id": data["sub"]})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenOut(
        access_token=create_token(user["id"], "access"),
        refresh_token=payload.refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name"), created_at=user["created_at"])


# ---------- Watches ----------
@api.get("/watches", response_model=List[Watch])
async def list_watches(user=Depends(current_user)):
    docs = await db.watches.find({"user_id": user["id"]}, {"_id": 0}).to_list(20)
    return docs


@api.post("/watches/{watch_id}/toggle", response_model=Watch)
async def toggle_watch(watch_id: str, user=Depends(current_user)):
    w = await db.watches.find_one({"id": watch_id, "user_id": user["id"]}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Watch not found")
    w["connected"] = not w["connected"]
    w["last_sync_at"] = datetime.now(timezone.utc)
    await db.watches.update_one({"id": watch_id}, {"$set": {
        "connected": w["connected"], "last_sync_at": w["last_sync_at"]
    }})
    return w


# ---------- Metrics ----------
@api.get("/metrics/summary", response_model=List[MetricSummary])
async def metrics_summary(user=Depends(current_user)):
    docs = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0, "updated_at": 0}).to_list(50)
    # preserve template order
    order = {m["metric"]: i for i, m in enumerate(DEFAULT_METRICS_TEMPLATE)}
    docs.sort(key=lambda d: order.get(d["metric"], 99))
    return docs


@api.post("/metrics/sync-now")
async def trigger_sync(user=Depends(current_user)):
    """Simulate a fresh sync pulse: adds small jitter to metric currents and appends events."""
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    now = datetime.now(timezone.utc)
    new_events = []
    for s in summaries:
        jitter = random.uniform(-0.02, 0.05) * s["current"]
        new_current = max(0, round(s["current"] + jitter, 1))
        new_trend = (s["trend"] + [new_current])[-14:]
        await db.metric_summaries.update_one(
            {"user_id": user["id"], "metric": s["metric"]},
            {"$set": {"current": new_current, "trend": new_trend, "updated_at": now}},
        )
        new_events.append({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "metric": s["metric"],
            "source": random.choice(["apple", "samsung"]),
            "destination": "cloud",
            "value": new_current,
            "unit": s["unit"],
            "status": "success",
            "created_at": now,
        })
    if new_events:
        await db.sync_events.insert_many(new_events)
    # Bump watch last_sync_at
    await db.watches.update_many({"user_id": user["id"]}, {"$set": {"last_sync_at": now}})
    return {"synced": len(new_events), "timestamp": now}


# ---------- Sync Preferences ----------
@api.get("/sync/preferences", response_model=List[SyncPref])
async def get_prefs(user=Depends(current_user)):
    docs = await db.sync_prefs.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    order = {m["metric"]: i for i, m in enumerate(DEFAULT_METRICS_TEMPLATE)}
    docs.sort(key=lambda d: order.get(d["metric"], 99))
    return docs


@api.put("/sync/preferences/{metric}", response_model=SyncPref)
async def update_pref(metric: str, pref: SyncPref, user=Depends(current_user)):
    await db.sync_prefs.update_one(
        {"user_id": user["id"], "metric": metric},
        {"$set": {"enabled": pref.enabled, "direction": pref.direction}},
        upsert=True,
    )
    return pref


@api.get("/sync/policy", response_model=ConflictPolicy)
async def get_policy(user=Depends(current_user)):
    doc = await db.conflict_policy.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return doc or ConflictPolicy().model_dump()


@api.put("/sync/policy", response_model=ConflictPolicy)
async def update_policy(policy: ConflictPolicy, user=Depends(current_user)):
    await db.conflict_policy.update_one(
        {"user_id": user["id"]}, {"$set": policy.model_dump()}, upsert=True
    )
    return policy


# ---------- Audit Log ----------
@api.get("/sync/events", response_model=List[SyncEvent])
async def list_events(user=Depends(current_user), limit: int = 30):
    docs = await db.sync_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


# ---------- Vault Export ----------
@api.get("/vault/export")
async def vault_export(user=Depends(current_user), fmt: str = "json"):
    summaries = await db.metric_summaries.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(50)
    events = await db.sync_events.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(100)
    return {
        "format": fmt,
        "exported_at": datetime.now(timezone.utc),
        "metrics": summaries,
        "events": events,
    }


# ---------- Root ----------
@api.get("/")
async def root():
    return {"app": "HealthBridge Vault", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.watches.create_index("user_id")
    await db.metric_summaries.create_index([("user_id", 1), ("metric", 1)], unique=True)
    await db.sync_prefs.create_index([("user_id", 1), ("metric", 1)], unique=True)
    await db.sync_events.create_index([("user_id", 1), ("created_at", -1)])
    log.info("HealthBridge Vault API ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
