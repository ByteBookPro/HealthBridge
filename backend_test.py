"""
HealthBridge Vault - Comprehensive Backend QA Test Suite
Tests all backend endpoints before app store publish.
"""
import asyncio
import httpx
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration
BASE_URL = "https://7969081e-99a1-4dc6-8788-5f471417a3c1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@healthbridge.app"
ADMIN_PASSWORD = "ySk4rWp4nSn5KsB8WvI4iF"
FREE_USER_EMAIL = f"freeuser_{int(datetime.now().timestamp())}@test.com"
FREE_USER_PASSWORD = "FreeUser123!"

# MongoDB connection for downgrading users
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "healthbridge")

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "critical": []
}

def log_pass(test_name: str, details: str = ""):
    print(f"✅ PASS: {test_name}")
    if details:
        print(f"   {details}")
    test_results["passed"].append(test_name)

def log_fail(test_name: str, error: str, critical: bool = False):
    symbol = "❌ CRITICAL" if critical else "⚠️  FAIL"
    print(f"{symbol}: {test_name}")
    print(f"   Error: {error}")
    test_results["failed"].append(test_name)
    if critical:
        test_results["critical"].append(f"{test_name}: {error}")

async def downgrade_user_to_free(email: str):
    """Downgrade a user to free tier in MongoDB"""
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        result = await db.users.update_one(
            {"email": email.lower()},
            {"$set": {
                "subscription.plan": "free",
                "subscription.status": "inactive",
                "subscription.is_trial": False,
                "subscription.current_period_end": None
            }}
        )
        client.close()
        return result.modified_count > 0
    except Exception as e:
        print(f"⚠️  Warning: Could not downgrade user in MongoDB: {e}")
        return False

async def test_auth_flow():
    """Test 1: Complete auth flow"""
    print("\n" + "="*80)
    print("TEST 1: AUTH FLOW")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1.1 Register new user
        try:
            resp = await client.post(f"{BASE_URL}/auth/register", json={
                "email": FREE_USER_EMAIL,
                "password": FREE_USER_PASSWORD,
                "name": "Free Test User"
            })
            if resp.status_code == 201:
                data = resp.json()
                if "access_token" in data and "refresh_token" in data:
                    log_pass("Auth: Register", f"User created with trial subscription")
                    free_user_tokens = {
                        "access": data["access_token"],
                        "refresh": data["refresh_token"]
                    }
                else:
                    log_fail("Auth: Register", "Missing tokens in response", critical=True)
                    return None
            else:
                log_fail("Auth: Register", f"Status {resp.status_code}: {resp.text}", critical=True)
                return None
        except Exception as e:
            log_fail("Auth: Register", str(e), critical=True)
            return None
        
        # 1.2 Login with admin credentials
        try:
            resp = await client.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            if resp.status_code == 200:
                data = resp.json()
                if "access_token" in data and "refresh_token" in data:
                    log_pass("Auth: Login (admin)", "Admin login successful")
                    admin_tokens = {
                        "access": data["access_token"],
                        "refresh": data["refresh_token"]
                    }
                else:
                    log_fail("Auth: Login", "Missing tokens in response", critical=True)
                    return None
            else:
                log_fail("Auth: Login", f"Status {resp.status_code}: {resp.text}", critical=True)
                return None
        except Exception as e:
            log_fail("Auth: Login", str(e), critical=True)
            return None
        
        # 1.3 Get current user (/auth/me)
        try:
            resp = await client.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {admin_tokens['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "id" in data and "email" in data and "subscription" in data:
                    log_pass("Auth: /auth/me", f"User: {data['email']}, Plan: {data['subscription']['plan']}")
                else:
                    log_fail("Auth: /auth/me", "Missing required fields", critical=True)
            else:
                log_fail("Auth: /auth/me", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Auth: /auth/me", str(e), critical=True)
        
        # 1.4 Refresh token
        try:
            resp = await client.post(f"{BASE_URL}/auth/refresh", json={
                "refresh_token": admin_tokens["refresh"]
            })
            if resp.status_code == 200:
                data = resp.json()
                if "access_token" in data:
                    log_pass("Auth: Refresh token", "New access token generated")
                    admin_tokens["access"] = data["access_token"]
                else:
                    log_fail("Auth: Refresh token", "Missing access_token", critical=True)
            else:
                log_fail("Auth: Refresh token", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Auth: Refresh token", str(e), critical=True)
        
        # 1.5 Update profile (patch name)
        try:
            resp = await client.patch(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {admin_tokens['access']}"},
                json={"name": "Admin Updated"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("name") == "Admin Updated":
                    log_pass("Auth: Update profile", "Name updated successfully")
                else:
                    log_fail("Auth: Update profile", "Name not updated")
            else:
                log_fail("Auth: Update profile", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Auth: Update profile", str(e))
        
        # 1.6 Change password
        try:
            resp = await client.post(
                f"{BASE_URL}/auth/password/change",
                headers={"Authorization": f"Bearer {admin_tokens['access']}"},
                json={
                    "current_password": ADMIN_PASSWORD,
                    "new_password": ADMIN_PASSWORD  # Change back to same for testing
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_pass("Auth: Change password", "Password changed successfully")
                else:
                    log_fail("Auth: Change password", "Response not ok")
            else:
                log_fail("Auth: Change password", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Auth: Change password", str(e))
        
        # 1.7 Forgot password
        try:
            resp = await client.post(f"{BASE_URL}/auth/password/forgot", json={
                "email": ADMIN_EMAIL
            })
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and "reset_token_dev_only" in data:
                    reset_token = data["reset_token_dev_only"]
                    log_pass("Auth: Forgot password", f"Reset token generated")
                    
                    # 1.8 Reset password
                    resp = await client.post(f"{BASE_URL}/auth/password/reset", json={
                        "token": reset_token,
                        "new_password": ADMIN_PASSWORD
                    })
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ok"):
                            log_pass("Auth: Reset password", "Password reset successful")
                        else:
                            log_fail("Auth: Reset password", "Response not ok")
                    else:
                        log_fail("Auth: Reset password", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Auth: Forgot password", "Missing reset token")
            else:
                log_fail("Auth: Forgot password", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Auth: Forgot/Reset password", str(e))
        
        return {
            "admin": admin_tokens,
            "free_user": free_user_tokens
        }

async def test_watches(tokens: dict):
    """Test 2: Watches list and toggle"""
    print("\n" + "="*80)
    print("TEST 2: WATCHES")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 2.1 List watches
        try:
            resp = await client.get(
                f"{BASE_URL}/watches",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                watches = resp.json()
                if isinstance(watches, list) and len(watches) >= 2:
                    log_pass("Watches: List", f"Found {len(watches)} watches")
                    watch_id = watches[0]["id"]
                    initial_connected = watches[0]["connected"]
                    
                    # 2.2 Toggle watch
                    resp = await client.post(
                        f"{BASE_URL}/watches/{watch_id}/toggle",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        toggled = resp.json()
                        if toggled["connected"] != initial_connected:
                            log_pass("Watches: Toggle", f"Connected status flipped: {initial_connected} → {toggled['connected']}")
                        else:
                            log_fail("Watches: Toggle", "Connected status did not change")
                    else:
                        log_fail("Watches: Toggle", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Watches: List", f"Expected >=2 watches, got {len(watches) if isinstance(watches, list) else 0}", critical=True)
            else:
                log_fail("Watches: List", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Watches", str(e), critical=True)

async def test_metrics(tokens: dict):
    """Test 3: Metrics summary, sync-now, ingest"""
    print("\n" + "="*80)
    print("TEST 3: METRICS")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 3.1 Get metrics summary
        try:
            resp = await client.get(
                f"{BASE_URL}/metrics/summary",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                metrics = resp.json()
                if isinstance(metrics, list) and len(metrics) == 8:
                    log_pass("Metrics: Summary", f"Got all 8 metrics")
                    # Verify structure
                    first = metrics[0]
                    required_fields = ["metric", "label", "unit", "current", "goal", "trend"]
                    if all(f in first for f in required_fields):
                        log_pass("Metrics: Summary structure", "All required fields present")
                    else:
                        log_fail("Metrics: Summary structure", f"Missing fields in response")
                else:
                    log_fail("Metrics: Summary", f"Expected 8 metrics, got {len(metrics) if isinstance(metrics, list) else 0}", critical=True)
            else:
                log_fail("Metrics: Summary", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Metrics: Summary", str(e), critical=True)
        
        # 3.2 Trigger sync-now
        try:
            resp = await client.post(
                f"{BASE_URL}/metrics/sync-now",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "synced" in data and "timestamp" in data:
                    log_pass("Metrics: Sync-now", f"Synced {data['synced']} metrics")
                else:
                    log_fail("Metrics: Sync-now", "Missing synced/timestamp in response")
            else:
                log_fail("Metrics: Sync-now", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Metrics: Sync-now", str(e))
        
        # 3.3 Ingest health samples
        try:
            resp = await client.post(
                f"{BASE_URL}/metrics/ingest",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "samples": [
                        {
                            "metric": "steps",
                            "value": 12500.0,
                            "unit": "steps",
                            "source": "apple"
                        },
                        {
                            "metric": "heart_rate",
                            "value": 75.0,
                            "unit": "bpm",
                            "source": "samsung"
                        }
                    ]
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ingested") == 2:
                    log_pass("Metrics: Ingest", "2 samples ingested successfully")
                    
                    # Verify trend updated
                    resp = await client.get(
                        f"{BASE_URL}/metrics/summary",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        metrics = resp.json()
                        steps_metric = next((m for m in metrics if m["metric"] == "steps"), None)
                        if steps_metric and steps_metric["current"] == 12500.0:
                            log_pass("Metrics: Ingest verification", "Trend updated with new value")
                        else:
                            log_fail("Metrics: Ingest verification", "Trend not updated correctly")
                else:
                    log_fail("Metrics: Ingest", f"Expected 2 ingested, got {data.get('ingested')}")
            else:
                log_fail("Metrics: Ingest", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Metrics: Ingest", str(e))

async def test_sync(tokens: dict):
    """Test 4: Sync preferences, policy, events"""
    print("\n" + "="*80)
    print("TEST 4: SYNC PREFERENCES, POLICY, EVENTS")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 4.1 Get sync preferences
        try:
            resp = await client.get(
                f"{BASE_URL}/sync/preferences",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                prefs = resp.json()
                if isinstance(prefs, list) and len(prefs) > 0:
                    log_pass("Sync: Get preferences", f"Got {len(prefs)} preferences")
                    
                    # 4.2 Update a preference
                    first_pref = prefs[0]
                    resp = await client.put(
                        f"{BASE_URL}/sync/preferences/{first_pref['metric']}",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                        json={
                            "metric": first_pref["metric"],
                            "enabled": not first_pref["enabled"],
                            "direction": "bidirectional"
                        }
                    )
                    if resp.status_code == 200:
                        log_pass("Sync: Update preference", f"Updated {first_pref['metric']} preference")
                    else:
                        log_fail("Sync: Update preference", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Sync: Get preferences", "No preferences found")
            else:
                log_fail("Sync: Get preferences", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Sync: Preferences", str(e))
        
        # 4.3 Get conflict policy
        try:
            resp = await client.get(
                f"{BASE_URL}/sync/policy",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                policy = resp.json()
                if "policy" in policy and "background_sync" in policy:
                    log_pass("Sync: Get policy", f"Policy: {policy['policy']}")
                    
                    # 4.4 Update policy
                    resp = await client.put(
                        f"{BASE_URL}/sync/policy",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                        json={
                            "policy": "apple_wins",
                            "background_sync": True,
                            "notifications": False
                        }
                    )
                    if resp.status_code == 200:
                        log_pass("Sync: Update policy", "Policy updated to apple_wins")
                    else:
                        log_fail("Sync: Update policy", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Sync: Get policy", "Missing required fields")
            else:
                log_fail("Sync: Get policy", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Sync: Policy", str(e))
        
        # 4.5 Get sync events
        try:
            resp = await client.get(
                f"{BASE_URL}/sync/events",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                events = resp.json()
                if isinstance(events, list):
                    log_pass("Sync: Get events", f"Got {len(events)} sync events")
                else:
                    log_fail("Sync: Get events", "Response not a list")
            else:
                log_fail("Sync: Get events", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Sync: Events", str(e))

async def test_vault_export(tokens: dict):
    """Test 5: Vault export (JSON and CSV)"""
    print("\n" + "="*80)
    print("TEST 5: VAULT EXPORT")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 5.1 Export as JSON
        try:
            resp = await client.get(
                f"{BASE_URL}/vault/export?fmt=json",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "format" in data and "metrics" in data and "events" in data:
                    log_pass("Vault: Export JSON", f"Exported {len(data['metrics'])} metrics, {len(data['events'])} events")
                else:
                    log_fail("Vault: Export JSON", "Missing required fields")
            else:
                log_fail("Vault: Export JSON", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Vault: Export JSON", str(e))
        
        # 5.2 Export as CSV
        try:
            resp = await client.get(
                f"{BASE_URL}/vault/export?fmt=csv",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "format" in data and data["format"] == "csv":
                    log_pass("Vault: Export CSV", "CSV export successful")
                else:
                    log_fail("Vault: Export CSV", "Format not CSV")
            else:
                log_fail("Vault: Export CSV", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Vault: Export CSV", str(e))

async def test_push(tokens: dict):
    """Test 6: Push token register and test"""
    print("\n" + "="*80)
    print("TEST 6: PUSH NOTIFICATIONS")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 6.1 Register push token
        try:
            resp = await client.post(
                f"{BASE_URL}/push/register",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
                    "platform": "ios",
                    "app_version": "2.0.0"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    log_pass("Push: Register token", "Token registered successfully")
                else:
                    log_fail("Push: Register token", "Response not ok")
            else:
                log_fail("Push: Register token", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Push: Register token", str(e))
        
        # 6.2 Test push notification
        try:
            resp = await client.post(
                f"{BASE_URL}/push/test",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "sent" in data:
                    log_pass("Push: Test notification", f"Sent to {data['sent']} devices")
                else:
                    log_fail("Push: Test notification", "Missing 'sent' field")
            else:
                log_fail("Push: Test notification", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Push: Test notification", str(e))
        
        # 6.3 Test push with no token (should not 500)
        try:
            # Create a new user without registering token
            new_email = f"notoken_{int(datetime.now().timestamp())}@test.com"
            resp = await client.post(f"{BASE_URL}/auth/register", json={
                "email": new_email,
                "password": "NoToken123!",
                "name": "No Token User"
            })
            if resp.status_code == 201:
                no_token_access = resp.json()["access_token"]
                resp = await client.post(
                    f"{BASE_URL}/push/test",
                    headers={"Authorization": f"Bearer {no_token_access}"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("sent") == 0 and "reason" in data:
                        log_pass("Push: No token graceful", f"Gracefully handled no token: {data.get('reason')}")
                    else:
                        log_fail("Push: No token graceful", "Expected sent=0 with reason")
                else:
                    log_fail("Push: No token graceful", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Push: No token graceful", str(e))

async def test_billing(tokens: dict):
    """Test 7: Billing (dev mode)"""
    print("\n" + "="*80)
    print("TEST 7: BILLING (DEV MODE)")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 7.1 Create checkout session
        try:
            resp = await client.post(
                f"{BASE_URL}/billing/checkout",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "success_path": "/(tabs)/vault?checkout=success",
                    "cancel_path": "/(tabs)/vault?checkout=cancel"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if "url" in data and data.get("demo") == True:
                    log_pass("Billing: Checkout (dev mode)", f"Demo checkout URL returned")
                    
                    # Verify user upgraded to PRO
                    resp = await client.get(
                        f"{BASE_URL}/auth/me",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        user = resp.json()
                        if user["subscription"]["plan"] == "pro" and user["subscription"]["status"] == "active":
                            log_pass("Billing: Checkout upgrade", "User upgraded to PRO")
                        else:
                            log_fail("Billing: Checkout upgrade", f"User not upgraded: {user['subscription']}")
                else:
                    log_fail("Billing: Checkout", "Missing url or demo flag", critical=True)
            else:
                log_fail("Billing: Checkout", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Billing: Checkout", str(e), critical=True)
        
        # 7.2 Create portal session
        try:
            resp = await client.post(
                f"{BASE_URL}/billing/portal",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "url" in data:
                    log_pass("Billing: Portal (dev mode)", "Portal URL returned")
                    
                    # Verify cancel_at_period_end set
                    resp = await client.get(
                        f"{BASE_URL}/auth/me",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        user = resp.json()
                        if user["subscription"]["cancel_at_period_end"] == True:
                            log_pass("Billing: Portal cancel", "cancel_at_period_end set to true")
                        else:
                            log_fail("Billing: Portal cancel", "cancel_at_period_end not set")
                else:
                    log_fail("Billing: Portal", "Missing url")
            else:
                log_fail("Billing: Portal", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Billing: Portal", str(e))

async def test_admin(tokens: dict):
    """Test 8: Admin endpoints"""
    print("\n" + "="*80)
    print("TEST 8: ADMIN ENDPOINTS")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 8.1 Admin stats
        try:
            resp = await client.get(
                f"{BASE_URL}/admin/stats",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                stats = resp.json()
                required = ["total_users", "pro_users", "active_subscriptions", "syncs_24h", "mrr_usd"]
                if all(k in stats for k in required):
                    log_pass("Admin: Stats", f"Total users: {stats['total_users']}, PRO: {stats['pro_users']}")
                else:
                    log_fail("Admin: Stats", "Missing required fields")
            else:
                log_fail("Admin: Stats", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Admin: Stats", str(e), critical=True)
        
        # 8.2 Admin users list
        try:
            resp = await client.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                users = resp.json()
                if isinstance(users, list) and len(users) > 0:
                    log_pass("Admin: Users list", f"Got {len(users)} users")
                    
                    # 8.3 Search users
                    resp = await client.get(
                        f"{BASE_URL}/admin/users?q=admin",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        search_results = resp.json()
                        if isinstance(search_results, list):
                            log_pass("Admin: Users search", f"Search returned {len(search_results)} results")
                        else:
                            log_fail("Admin: Users search", "Response not a list")
                    else:
                        log_fail("Admin: Users search", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Admin: Users list", "No users found")
            else:
                log_fail("Admin: Users list", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Admin: Users", str(e), critical=True)
        
        # 8.4 Set user plan
        try:
            # Get a user ID first
            resp = await client.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                users = resp.json()
                if len(users) > 0:
                    test_user_id = users[0]["id"]
                    resp = await client.post(
                        f"{BASE_URL}/admin/users/{test_user_id}/plan?plan=free",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ok"):
                            log_pass("Admin: Set plan", f"Set user {test_user_id[:8]}... to free")
                        else:
                            log_fail("Admin: Set plan", "Response not ok")
                    else:
                        log_fail("Admin: Set plan", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Admin: Set plan", str(e))
        
        # 8.5 Cancel subscription
        try:
            resp = await client.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                users = resp.json()
                if len(users) > 0:
                    test_user_id = users[0]["id"]
                    resp = await client.post(
                        f"{BASE_URL}/admin/users/{test_user_id}/cancel",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ok"):
                            log_pass("Admin: Cancel subscription", f"Cancelled subscription for {test_user_id[:8]}...")
                        else:
                            log_fail("Admin: Cancel subscription", "Response not ok")
                    else:
                        log_fail("Admin: Cancel subscription", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Admin: Cancel subscription", str(e))
        
        # 8.6 Broadcast push
        try:
            resp = await client.post(
                f"{BASE_URL}/admin/broadcast",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "title": "Test Broadcast",
                    "body": "This is a test broadcast message",
                    "data": {"test": True}
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if "recipients" in data and "sent" in data:
                    log_pass("Admin: Broadcast", f"Broadcast to {data['recipients']} users, sent {data['sent']}")
                else:
                    log_fail("Admin: Broadcast", "Missing recipients/sent fields")
            else:
                log_fail("Admin: Broadcast", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Admin: Broadcast", str(e))
        
        # 8.7 Audit log
        try:
            resp = await client.get(
                f"{BASE_URL}/admin/audit",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                audit = resp.json()
                if "sync_events" in audit and "notifications" in audit:
                    log_pass("Admin: Audit", f"Got {len(audit['sync_events'])} sync events, {len(audit['notifications'])} notifications")
                else:
                    log_fail("Admin: Audit", "Missing sync_events/notifications")
            else:
                log_fail("Admin: Audit", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Admin: Audit", str(e))

async def test_migration(tokens: dict):
    """Test 9: Migration wizard"""
    print("\n" + "="*80)
    print("TEST 9: MIGRATION WIZARD")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 9.1 Start migration
        try:
            resp = await client.post(
                f"{BASE_URL}/migrate/start",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "source": "apple",
                    "target": "samsung",
                    "range_days": 30
                }
            )
            if resp.status_code == 200:
                job = resp.json()
                if "id" in job and job["status"] == "running":
                    log_pass("Migration: Start", f"Job {job['id'][:8]}... started")
                    job_id = job["id"]
                    
                    # 9.2 Poll migration job until complete
                    max_polls = 15
                    for i in range(max_polls):
                        await asyncio.sleep(1)
                        resp = await client.get(
                            f"{BASE_URL}/migrate/jobs/{job_id}",
                            headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                        )
                        if resp.status_code == 200:
                            job = resp.json()
                            if job["progress"] == 100:
                                log_pass("Migration: Progress", f"Job completed: {job['samples_migrated']} samples migrated")
                                break
                            elif i == max_polls - 1:
                                log_fail("Migration: Progress", f"Job did not complete after {max_polls}s, stuck at {job['progress']}%")
                        else:
                            log_fail("Migration: Get job", f"Status {resp.status_code}: {resp.text}")
                            break
                    
                    # 9.3 List migration jobs
                    resp = await client.get(
                        f"{BASE_URL}/migrate/jobs",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        jobs = resp.json()
                        if isinstance(jobs, list) and len(jobs) > 0:
                            log_pass("Migration: List jobs", f"Got {len(jobs)} migration jobs")
                        else:
                            log_fail("Migration: List jobs", "No jobs found")
                    else:
                        log_fail("Migration: List jobs", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Migration: Start", "Missing id or status not running", critical=True)
            else:
                log_fail("Migration: Start", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("Migration", str(e), critical=True)

async def test_notification_bridge(tokens: dict):
    """Test 10: Notification bridge"""
    print("\n" + "="*80)
    print("TEST 10: NOTIFICATION BRIDGE")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 10.1 Get notification settings
        try:
            resp = await client.get(
                f"{BASE_URL}/bridge/notifications/settings",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                settings = resp.json()
                if "enabled" in settings and "apps_allowed" in settings:
                    log_pass("Notif Bridge: Get settings", f"Enabled: {settings['enabled']}")
                    
                    # 10.2 Update settings
                    resp = await client.put(
                        f"{BASE_URL}/bridge/notifications/settings",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                        json={
                            "enabled": True,
                            "apps_allowed": ["whatsapp", "telegram"],
                            "quiet_hours_start": None,
                            "quiet_hours_end": None,
                            "silent_mode": False
                        }
                    )
                    if resp.status_code == 200:
                        log_pass("Notif Bridge: Update settings", "Settings updated")
                    else:
                        log_fail("Notif Bridge: Update settings", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("Notif Bridge: Get settings", "Missing required fields")
            else:
                log_fail("Notif Bridge: Get settings", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Notif Bridge: Settings", str(e))
        
        # 10.3 Post notification event (allowed app)
        try:
            resp = await client.post(
                f"{BASE_URL}/bridge/notifications/event",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "app": "whatsapp",
                    "title": "New message",
                    "body": "Hello from WhatsApp",
                    "direction": "phone_to_watch",
                    "watch_platform": "samsung"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("forwarded") == True:
                    log_pass("Notif Bridge: Event (allowed)", "Notification forwarded")
                else:
                    log_fail("Notif Bridge: Event (allowed)", f"Not forwarded: {data.get('reason')}")
            else:
                log_fail("Notif Bridge: Event (allowed)", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Notif Bridge: Event (allowed)", str(e))
        
        # 10.4 Post notification event (disallowed app)
        try:
            resp = await client.post(
                f"{BASE_URL}/bridge/notifications/event",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "app": "instagram",
                    "title": "New like",
                    "body": "Someone liked your post",
                    "direction": "phone_to_watch",
                    "watch_platform": "samsung"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("forwarded") == False and data.get("reason") == "app_not_allowed":
                    log_pass("Notif Bridge: Event (disallowed)", "Correctly blocked disallowed app")
                else:
                    log_fail("Notif Bridge: Event (disallowed)", f"Should not forward: {data}")
            else:
                log_fail("Notif Bridge: Event (disallowed)", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Notif Bridge: Event (disallowed)", str(e))
        
        # 10.5 Get notification log
        try:
            resp = await client.get(
                f"{BASE_URL}/bridge/notifications/log",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                log_data = resp.json()
                if isinstance(log_data, list):
                    log_pass("Notif Bridge: Get log", f"Got {len(log_data)} log entries")
                else:
                    log_fail("Notif Bridge: Get log", "Response not a list")
            else:
                log_fail("Notif Bridge: Get log", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Notif Bridge: Get log", str(e))

async def test_pro_gating(tokens: dict):
    """Test 11: PRO gating with FREE user"""
    print("\n" + "="*80)
    print("TEST 11: PRO GATING (FREE USER)")
    print("="*80)
    
    # Downgrade the free user to actual free tier
    print(f"Downgrading {FREE_USER_EMAIL} to free tier...")
    downgraded = await downgrade_user_to_free(FREE_USER_EMAIL)
    if not downgraded:
        log_fail("PRO Gating: Setup", "Could not downgrade user to free tier", critical=True)
        return
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 11.1 Test POST /goals (should 402)
        try:
            resp = await client.post(
                f"{BASE_URL}/goals",
                headers={"Authorization": f"Bearer {tokens['free_user']['access']}"},
                json={
                    "metric": "steps",
                    "target": 10000,
                    "period": "daily"
                }
            )
            if resp.status_code == 402:
                log_pass("PRO Gating: POST /goals", "Correctly returned 402 for free user")
            else:
                log_fail("PRO Gating: POST /goals", f"Expected 402, got {resp.status_code}", critical=True)
        except Exception as e:
            log_fail("PRO Gating: POST /goals", str(e), critical=True)
        
        # 11.2 Test GET /reports/weekly (should 402)
        try:
            resp = await client.get(
                f"{BASE_URL}/reports/weekly",
                headers={"Authorization": f"Bearer {tokens['free_user']['access']}"}
            )
            if resp.status_code == 402:
                log_pass("PRO Gating: GET /reports/weekly", "Correctly returned 402 for free user")
            else:
                log_fail("PRO Gating: GET /reports/weekly", f"Expected 402, got {resp.status_code}", critical=True)
        except Exception as e:
            log_fail("PRO Gating: GET /reports/weekly", str(e), critical=True)
        
        # 11.3 Test POST /insights/generate (should 402)
        try:
            resp = await client.post(
                f"{BASE_URL}/insights/generate",
                headers={"Authorization": f"Bearer {tokens['free_user']['access']}"}
            )
            if resp.status_code == 402:
                log_pass("PRO Gating: POST /insights/generate", "Correctly returned 402 for free user")
            else:
                log_fail("PRO Gating: POST /insights/generate", f"Expected 402, got {resp.status_code}", critical=True)
        except Exception as e:
            log_fail("PRO Gating: POST /insights/generate", str(e), critical=True)

async def test_pro_features(tokens: dict):
    """Test 12: PRO features with admin/PRO user"""
    print("\n" + "="*80)
    print("TEST 12: PRO FEATURES (ADMIN/PRO USER)")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 12.1 Create goal
        try:
            resp = await client.post(
                f"{BASE_URL}/goals",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"},
                json={
                    "metric": "steps",
                    "target": 10000,
                    "period": "daily"
                }
            )
            if resp.status_code == 201:
                goal = resp.json()
                if "id" in goal and goal["metric"] == "steps":
                    log_pass("PRO: Create goal", f"Goal created: {goal['metric']} target {goal['target']}")
                    goal_id = goal["id"]
                    
                    # 12.2 Get goals
                    resp = await client.get(
                        f"{BASE_URL}/goals",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        goals = resp.json()
                        if isinstance(goals, list) and len(goals) > 0:
                            log_pass("PRO: Get goals", f"Got {len(goals)} goals")
                        else:
                            log_fail("PRO: Get goals", "No goals found")
                    else:
                        log_fail("PRO: Get goals", f"Status {resp.status_code}: {resp.text}")
                    
                    # 12.3 Delete goal
                    resp = await client.delete(
                        f"{BASE_URL}/goals/{goal_id}",
                        headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("ok"):
                            log_pass("PRO: Delete goal", f"Goal {goal_id[:8]}... deleted")
                        else:
                            log_fail("PRO: Delete goal", "Response not ok")
                    else:
                        log_fail("PRO: Delete goal", f"Status {resp.status_code}: {resp.text}")
                else:
                    log_fail("PRO: Create goal", "Missing id or incorrect metric")
            else:
                log_fail("PRO: Create goal", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("PRO: Goals", str(e), critical=True)
        
        # 12.4 Get weekly report
        try:
            resp = await client.get(
                f"{BASE_URL}/reports/weekly",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                report = resp.json()
                if "period_start" in report and "breakdown" in report:
                    log_pass("PRO: Weekly report", f"Report with {len(report['breakdown'])} metrics")
                else:
                    log_fail("PRO: Weekly report", "Missing required fields")
            else:
                log_fail("PRO: Weekly report", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("PRO: Weekly report", str(e), critical=True)
        
        # 12.5 Generate AI insights
        try:
            resp = await client.post(
                f"{BASE_URL}/insights/generate",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                insights = resp.json()
                if isinstance(insights, list) and len(insights) <= 4:
                    log_pass("PRO: AI Insights generate", f"Generated {len(insights)} insights")
                    
                    # Verify insight structure
                    if len(insights) > 0:
                        first = insights[0]
                        required = ["id", "title", "summary", "severity"]
                        if all(f in first for f in required):
                            log_pass("PRO: AI Insights structure", "All required fields present")
                        else:
                            log_fail("PRO: AI Insights structure", "Missing required fields")
                else:
                    log_fail("PRO: AI Insights generate", f"Expected <=4 insights, got {len(insights) if isinstance(insights, list) else 0}")
            elif resp.status_code == 503:
                log_fail("PRO: AI Insights generate", "AI service not configured (EMERGENT_LLM_KEY missing)", critical=True)
            elif resp.status_code == 502:
                log_fail("PRO: AI Insights generate", f"AI service error: {resp.text}", critical=True)
            else:
                log_fail("PRO: AI Insights generate", f"Status {resp.status_code}: {resp.text}", critical=True)
        except Exception as e:
            log_fail("PRO: AI Insights generate", str(e), critical=True)
        
        # 12.6 Get insights list
        try:
            resp = await client.get(
                f"{BASE_URL}/insights",
                headers={"Authorization": f"Bearer {tokens['admin']['access']}"}
            )
            if resp.status_code == 200:
                insights = resp.json()
                if isinstance(insights, list):
                    log_pass("PRO: Get insights", f"Got {len(insights)} insights")
                else:
                    log_fail("PRO: Get insights", "Response not a list")
            else:
                log_fail("PRO: Get insights", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("PRO: Get insights", str(e))

async def test_legal():
    """Test 13: Legal endpoints"""
    print("\n" + "="*80)
    print("TEST 13: LEGAL ENDPOINTS")
    print("="*80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 13.1 Privacy policy
        try:
            resp = await client.get(f"{BASE_URL}/legal/privacy")
            if resp.status_code == 200:
                data = resp.json()
                if "version" in data and "doc" in data:
                    log_pass("Legal: Privacy", f"Version: {data['version']}")
                else:
                    log_fail("Legal: Privacy", "Missing required fields")
            else:
                log_fail("Legal: Privacy", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Legal: Privacy", str(e))
        
        # 13.2 Terms of service
        try:
            resp = await client.get(f"{BASE_URL}/legal/terms")
            if resp.status_code == 200:
                data = resp.json()
                if "version" in data and "doc" in data:
                    log_pass("Legal: Terms", f"Version: {data['version']}")
                else:
                    log_fail("Legal: Terms", "Missing required fields")
            else:
                log_fail("Legal: Terms", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_fail("Legal: Terms", str(e))

async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("HEALTHBRIDGE VAULT - COMPREHENSIVE BACKEND QA TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Free User: {FREE_USER_EMAIL}")
    print("="*80)
    
    # Run all tests
    tokens = await test_auth_flow()
    if not tokens:
        print("\n❌ CRITICAL: Auth flow failed, cannot continue")
        return
    
    await test_watches(tokens)
    await test_metrics(tokens)
    await test_sync(tokens)
    await test_vault_export(tokens)
    await test_push(tokens)
    await test_billing(tokens)
    await test_admin(tokens)
    await test_migration(tokens)
    await test_notification_bridge(tokens)
    await test_pro_gating(tokens)
    await test_pro_features(tokens)
    await test_legal()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ Passed: {len(test_results['passed'])}")
    print(f"⚠️  Failed: {len(test_results['failed'])}")
    print(f"❌ Critical: {len(test_results['critical'])}")
    
    if test_results['critical']:
        print("\n❌ CRITICAL ISSUES:")
        for issue in test_results['critical']:
            print(f"  - {issue}")
    
    if test_results['failed']:
        print(f"\n⚠️  FAILED TESTS: {len(test_results['failed'])}")
    
    print("\n" + "="*80)
    if len(test_results['critical']) == 0:
        print("✅ NO CRITICAL ISSUES - Ready for app store publish")
    else:
        print("❌ CRITICAL ISSUES FOUND - Must fix before publish")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())
