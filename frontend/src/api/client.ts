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

export type User = { id: string; email: string; name?: string | null; created_at: string };

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
};
