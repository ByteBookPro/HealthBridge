import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokens, type User } from '@/src/api/client';

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAuthed: boolean;
  vaultUnlocked: boolean;
  setVaultUnlocked: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await tokens.getAccess();
      if (t) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const out = await api.login(email, password);
    await tokens.setAccess(out.access_token);
    await tokens.setRefresh(out.refresh_token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const out = await api.register(email, password, name);
    await tokens.setAccess(out.access_token);
    await tokens.setRefresh(out.refresh_token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await tokens.clear();
    setUser(null);
    setVaultUnlocked(false);
  }, []);

  return (
    <Ctx.Provider
      value={{ user, loading, isAuthed: !!user, vaultUnlocked, setVaultUnlocked, login, register, logout, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
