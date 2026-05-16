/**
 * useDevice — returns a stable per-device id and a friendly label, persisting
 * the id in storage on first launch. Auto-registers the device against the
 * backend on first mount so per-device primary-source overrides have a
 * consistent profile to attach to.
 *
 * On web each browser counts as a "device". On native (real EAS build) the
 * id survives reinstalls because we use SecureStore (Keychain / encrypted
 * shared prefs) on those platforms.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';
import { api } from '@/src/api/client';

const DEVICE_ID_KEY = '@healthbridge_device_id';
const DEVICE_LABEL_KEY = '@healthbridge_device_label';

type DeviceState = {
  deviceId: string | null;
  label: string;
  platform: 'ios' | 'android' | 'web';
  ready: boolean;
};

function randomId(): string {
  // Lightweight UUID-ish — no native crypto dependency, fine for an
  // opaque user-scoped device identifier.
  const rnd = () => Math.random().toString(36).slice(2, 10);
  return `${rnd()}-${rnd()}-${Date.now().toString(36)}`;
}

function defaultLabel(): string {
  if (Platform.OS === 'ios') return 'iPhone';
  if (Platform.OS === 'android') return 'Android Phone';
  // Web — try to surface a host hint so households can tell devices apart
  try {
    const ua = (globalThis as any)?.navigator?.userAgent || '';
    if (/iPad/i.test(ua)) return 'iPad (Web)';
    if (/iPhone/i.test(ua)) return 'iPhone (Web)';
    if (/Android/i.test(ua)) return 'Android (Web)';
    if (/Macintosh/i.test(ua)) return 'Mac (Web)';
    if (/Windows/i.test(ua)) return 'Windows (Web)';
  } catch {}
  return 'This device';
}

export function useDevice(): DeviceState {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [label, setLabel] = useState<string>(defaultLabel());
  const [ready, setReady] = useState(false);
  const platform = Platform.OS as 'ios' | 'android' | 'web';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = await storage.secureGet<string>(DEVICE_ID_KEY, '');
      if (!id) {
        id = randomId();
        await storage.secureSet(DEVICE_ID_KEY, id);
      }
      const storedLabel = await storage.getItem<string>(DEVICE_LABEL_KEY, '');
      const effectiveLabel = storedLabel || defaultLabel();
      if (!storedLabel) {
        await storage.setItem(DEVICE_LABEL_KEY, effectiveLabel);
      }
      if (cancelled) return;
      setDeviceId(id);
      setLabel(effectiveLabel);
      setReady(true);
      // Best-effort register on backend; ignore failures (e.g. not signed in yet).
      api.registerDevice(id, effectiveLabel, platform).catch(() => undefined);
    })();
    return () => { cancelled = true; };
  }, [platform]);

  return { deviceId, label, platform, ready };
}

export async function renameDeviceLabel(newLabel: string): Promise<void> {
  await storage.setItem(DEVICE_LABEL_KEY, newLabel);
  const id = await storage.secureGet<string>(DEVICE_ID_KEY, '');
  if (id) {
    const platform = Platform.OS as 'ios' | 'android' | 'web';
    await api.registerDevice(id, newLabel, platform).catch(() => undefined);
  }
}
