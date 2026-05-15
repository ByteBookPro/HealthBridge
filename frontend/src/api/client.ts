import { storage } from '@/src/utils/storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_URL = `${API_BASE}/api`;

const ACCESS_KEY = 'hbv_access_token';
const REFRESH_KEY = 'hbv_refresh_token';

export const tokens = {
  async getAccess(): Promise<string | null> {
    return (await storage.secureGet<string>(ACCESS_KEY, '')) || null;
  },
  async setAccess(v: string) {
    await storage.secureSet(ACCESS_KEY, v);
  },
  async getRefresh(): Promise<string | null> {
    return (await storage.secureGet<string>(REFRESH_KEY, '')) || null;
  },
  async setRefresh(v: string) {
    await storage.secureSet(REFRESH_KEY, v);
  },
  async clear() {
    await storage.secureRemove(ACCESS_KEY);
    await storage.secureRemove(REFRESH_KEY);
  },
};

async function refreshTokens(): Promise<boolean> {
  const rt = await tokens.getRefresh();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    await tokens.setAccess(data.access_token);
    if (data.refresh_token) await tokens.setRefresh(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const access = await tokens.getAccess();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, init, false);
  }
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {}
    const msg = detail?.detail || `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export type AuthOut = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type User = {
  id: string;
  email: string;
  name?: string | null;
  created_at: string;
  is_admin?: boolean;
  subscription?: {
    plan: 'free' | 'pro';
    status: string;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    stripe_customer_id?: string | null;
  };
};

export type AdminStats = {
  total_users: number; pro_users: number; active_subscriptions: number;
  syncs_24h: number; notifications_sent: number; mrr_usd: number;
};

export type Watch = {
  id: string;
  user_id: string;
  platform: 'apple' | 'samsung' | 'google' | 'cloud';
  model: string;
  battery: number;
  connected: boolean;
  last_sync_at: string;
};

export type MetricKey =
  | 'steps' | 'heart_rate' | 'sleep' | 'workouts'
  | 'spo2' | 'ecg' | 'calories' | 'stand';

export type MetricSummary = {
  metric: MetricKey;
  label: string;
  unit: string;
  current: number;
  goal: number;
  trend: number[];
  apple_value: number | null;
  samsung_value: number | null;
  delta_pct: number;
};

export type SyncPref = {
  metric: MetricKey;
  enabled: boolean;
  direction: 'bidirectional' | 'apple_to_samsung' | 'samsung_to_apple';
};

export type SyncEvent = {
  id: string;
  metric: MetricKey;
  source: 'apple' | 'samsung' | 'google' | 'cloud';
  destination: 'apple' | 'samsung' | 'google' | 'cloud';
  value: number;
  unit: string;
  status: 'success' | 'conflict_resolved' | 'queued' | 'failed';
  created_at: string;
};

export type ConflictPolicy = {
  policy: 'latest_wins' | 'apple_wins' | 'samsung_wins' | 'manual';
  background_sync: boolean;
  notifications: boolean;
};

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<AuthOut>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthOut>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),
  watches: () => request<Watch[]>('/watches'),
  toggleWatch: (id: string) => request<Watch>(`/watches/${id}/toggle`, { method: 'POST' }),
  metrics: () => request<MetricSummary[]>('/metrics/summary'),
  syncNow: () => request<{ synced: number; timestamp: string }>('/metrics/sync-now', { method: 'POST' }),
  prefs: () => request<SyncPref[]>('/sync/preferences'),
  updatePref: (metric: string, pref: SyncPref) =>
    request<SyncPref>(`/sync/preferences/${metric}`, { method: 'PUT', body: JSON.stringify(pref) }),
  policy: () => request<ConflictPolicy>('/sync/policy'),
  updatePolicy: (p: ConflictPolicy) =>
    request<ConflictPolicy>('/sync/policy', { method: 'PUT', body: JSON.stringify(p) }),
  events: (limit = 30) => request<SyncEvent[]>(`/sync/events?limit=${limit}`),
  export: (fmt = 'json') => request<any>(`/vault/export?fmt=${fmt}`),

  // Profile / password
  updateProfile: (name: string) => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('/auth/password/change', { method: 'POST',
      body: JSON.stringify({ current_password, new_password }) }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; reset_token_dev_only?: string }>('/auth/password/forgot', {
      method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    request<{ ok: boolean }>('/auth/password/reset', { method: 'POST',
      body: JSON.stringify({ token, new_password }) }),

  // Push
  registerPush: (token: string, platform: 'ios' | 'android' | 'web', app_version?: string) =>
    request<{ ok: boolean }>('/push/register', { method: 'POST',
      body: JSON.stringify({ token, platform, app_version }) }),
  pushTest: () => request<{ sent: number }>('/push/test', { method: 'POST' }),

  // Billing
  checkout: (success_path?: string, cancel_path?: string) =>
    request<{ url: string; id: string }>('/billing/checkout', { method: 'POST',
      body: JSON.stringify({ success_path, cancel_path }) }),
  portal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),

  // Native bridge → cloud
  ingest: (samples: any[]) =>
    request<{ ingested: number }>('/metrics/ingest', { method: 'POST',
      body: JSON.stringify({ samples }) }),

  // Admin
  adminStats: () => request<AdminStats>('/admin/stats'),
  adminUsers: (q?: string) =>
    request<User[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetPlan: (user_id: string, plan: 'free' | 'pro') =>
    request<{ ok: boolean }>(`/admin/users/${user_id}/plan?plan=${plan}`, { method: 'POST' }),
  adminCancelSub: (user_id: string, immediate = false) =>
    request<{ ok: boolean }>(`/admin/users/${user_id}/cancel?immediate=${immediate}`, { method: 'POST' }),
  adminBroadcast: (title: string, body: string, data?: any) =>
    request<{ recipients: number; sent: number }>('/admin/broadcast', {
      method: 'POST', body: JSON.stringify({ title, body, data }) }),
  adminAudit: () => request<{ sync_events: any[]; notifications: any[] }>('/admin/audit'),

  // Migration wizard
  migrateStart: (source: string, target: string, range_days = 90, metrics?: string[]) =>
    request<any>('/migrate/start', { method: 'POST',
      body: JSON.stringify({ source, target, range_days, metrics }) }),
  migrateJob: (id: string) => request<any>(`/migrate/jobs/${id}`),
  migrateList: () => request<any[]>('/migrate/jobs'),

  // Notification bridge
  notifSettings: () => request<any>('/bridge/notifications/settings'),
  updateNotifSettings: (s: any) =>
    request<any>('/bridge/notifications/settings', { method: 'PUT', body: JSON.stringify(s) }),
  notifEvent: (app: string, title: string, body: string, watch_platform: 'apple' | 'samsung' = 'samsung') =>
    request<{ forwarded: boolean; id?: string; reason?: string }>('/bridge/notifications/event', {
      method: 'POST', body: JSON.stringify({ app, title, body, watch_platform }) }),
  notifLog: (limit = 50) => request<any[]>(`/bridge/notifications/log?limit=${limit}`),

  // Goals (PRO)
  goals: () => request<any[]>('/goals'),
  createGoal: (metric: string, target: number, period: 'daily' | 'weekly' = 'daily') =>
    request<any>('/goals', { method: 'POST', body: JSON.stringify({ metric, target, period }) }),
  deleteGoal: (id: string) => request<any>(`/goals/${id}`, { method: 'DELETE' }),

  // Weekly report (PRO)
  weeklyReport: () => request<any>('/reports/weekly'),

  // AI Insights (PRO)
  generateInsights: () => request<any[]>('/insights/generate', { method: 'POST' }),
  insights: () => request<any[]>('/insights'),

  // Metric detail (enhanced health data)
  metricDetail: (metric: string, timeRange: string = 'week') =>
    request<any>(`/metrics/${metric}/detail?time_range=${timeRange}`),

  // Health setup / Universal watch connectivity
  saveHealthSetup: (setup: {
    platform: string;
    watches: string[];
    healthKitGranted?: boolean;
    healthConnectGranted?: boolean;
  }) => request<any>('/health/setup', { method: 'POST', body: JSON.stringify(setup) }),
  
  getHealthSetup: () => request<any>('/health/setup'),
  
  getHealthPlatforms: () => request<any>('/health/platforms'),
};
