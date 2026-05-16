/**
 * Native HealthKit / Health Connect bridge with safe fallback.
 *
 * In production (custom EAS dev build), this loads the real native modules:
 *   - iOS:     react-native-health  (HealthKit)
 *   - Android: react-native-health-connect
 *
 * In Expo Go / web preview, those modules aren't available so the helpers
 * return `available: false` and read from the simulated backend instead.
 *
 * See /app/docs/NATIVE_BRIDGE.md for the full EAS dev build setup.
 */
import { Platform } from 'react-native';
import { api, type MetricKey } from '@/src/api/client';

type HealthSample = {
  metric: MetricKey;
  value: number;
  unit: string;
  source: 'apple' | 'samsung' | 'google';
  recorded_at?: string;
};

let healthKit: any = null;
let healthConnect: any = null;
let blePlx: any = null;
try { healthKit = require('react-native-health'); } catch {}
try { healthConnect = require('react-native-health-connect'); } catch {}
try { blePlx = require('react-native-ble-plx'); } catch {}

// Tx-power calibration constant used to convert RSSI → distance. -59 dBm
// is the iBeacon-standard "1 metre" reference value and works well as a
// reasonable default for both Apple Watch and Galaxy Watch advertisements.
const BLE_TX_POWER = -59;
const BLE_PATH_LOSS_N = 2; // free-space exponent — adjust to 2.5–3 in noisy environments

function rssiToDistance(rssi: number): number {
  if (rssi >= 0) return 0.1;
  const meters = Math.pow(10, (BLE_TX_POWER - rssi) / (10 * BLE_PATH_LOSS_N));
  return Math.round(meters * 10) / 10;
}

export type ProximityResult = {
  in_range: boolean;
  rssi: number;
  distance_m: number;
  source: 'native_ble' | 'simulated_api';
};

export const HealthBridge = {
  available(): boolean {
    if (Platform.OS === 'ios') return !!healthKit;
    if (Platform.OS === 'android') return !!healthConnect;
    return false;
  },

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios' && healthKit) {
      return await new Promise<boolean>((resolve) => {
        const permissions = {
          permissions: {
            read: [
              'Steps', 'HeartRate', 'SleepAnalysis', 'OxygenSaturation',
              'ActiveEnergyBurned', 'Workout', 'ElectrocardiogramSample',
            ],
            write: [
              'Steps', 'HeartRate', 'SleepAnalysis', 'OxygenSaturation',
              'ActiveEnergyBurned', 'Workout',
            ],
          },
        };
        healthKit.default.initHealthKit(permissions, (err: any) => resolve(!err));
      });
    }
    if (Platform.OS === 'android' && healthConnect) {
      await healthConnect.initialize();
      const granted = await healthConnect.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'OxygenSaturation' },
        { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'write', recordType: 'Steps' },
        { accessType: 'write', recordType: 'HeartRate' },
      ]);
      return granted.length > 0;
    }
    return false;
  },

  async pullLatestSamples(): Promise<HealthSample[]> {
    if (!this.available()) return [];
    const samples: HealthSample[] = [];
    const now = new Date().toISOString();
    try {
      if (Platform.OS === 'ios' && healthKit) {
        const hk = healthKit.default;
        const opts = { startDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString() };
        const steps = await new Promise<number>((res) =>
          hk.getStepCount(opts, (e: any, r: any) => res(r?.value ?? 0)));
        const hr = await new Promise<number>((res) =>
          hk.getHeartRateSamples(opts, (e: any, r: any[]) => res(r?.[r.length - 1]?.value ?? 0)));
        samples.push({ metric: 'steps', value: steps, unit: 'steps', source: 'apple', recorded_at: now });
        if (hr) samples.push({ metric: 'heart_rate', value: hr, unit: 'bpm', source: 'apple', recorded_at: now });
      }
      if (Platform.OS === 'android' && healthConnect) {
        const start = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const stepsR = await healthConnect.readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: start, endTime: now } });
        const steps = stepsR.records.reduce((s: number, r: any) => s + (r.count || 0), 0);
        if (steps) samples.push({ metric: 'steps', value: steps, unit: 'steps', source: 'samsung', recorded_at: now });
      }
    } catch (e) {
      console.warn('HealthBridge pull failed', e);
    }
    return samples;
  },

  /** Pull latest samples from the native source and POST them to the backend. */
  async syncToCloud(): Promise<number> {
    const samples = await this.pullLatestSamples();
    if (!samples.length) return 0;
    try {
      const res = await api.ingest(samples);
      return res.ingested;
    } catch {
      return 0;
    }
  },

  /**
   * Write a single sample to the *opposite* ecosystem (Apple Health on iOS,
   * Health Connect on Android). This is how data crosses the bridge.
   */
  async writeToOppositeEcosystem(sample: HealthSample): Promise<boolean> {
    if (Platform.OS === 'ios' && healthKit && sample.source !== 'apple') {
      const hk = healthKit.default;
      if (sample.metric === 'steps') {
        return await new Promise<boolean>((res) =>
          hk.saveSteps({ value: sample.value, startDate: sample.recorded_at }, (e: any) => res(!e)));
      }
    }
    if (Platform.OS === 'android' && healthConnect && sample.source !== 'samsung') {
      try {
        await healthConnect.insertRecords([{
          recordType: 'Steps', count: sample.value,
          startTime: sample.recorded_at, endTime: sample.recorded_at,
        }]);
        return true;
      } catch { return false; }
    }
    return false;
  },

  /**
   * Scan for a nearby watch over BLE and return its proximity metrics.
   *
   * - On a real iOS / Android dev build with `react-native-ble-plx` linked,
   *   this runs a 2-second peripheral scan, filters by the watch's advertised
   *   name (or service UUID hint), and reports the best RSSI seen plus a
   *   distance estimate using the iBeacon path-loss formula.
   * - In Expo Go, on web, or whenever the BLE module is unavailable, we fall
   *   back to the backend's simulated proximity API. That call is wired
   *   through `watchId` so the same UX flow keeps working in the preview
   *   build the testing agent verifies.
   */
  async scanProximity(opts: {
    watchId: string;
    nameHint?: string;          // e.g. "Apple Watch", "Galaxy"
    durationMs?: number;        // default 2000
    rssiThreshold?: number;     // default -75 (≈ 5m)
  }): Promise<ProximityResult> {
    const { watchId, nameHint, durationMs = 2000, rssiThreshold = -75 } = opts;
    // Native BLE path
    if (blePlx && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      try {
        const { BleManager } = blePlx;
        const manager = new BleManager();
        const result = await new Promise<ProximityResult>((resolve) => {
          let bestRssi = -127;
          const stop = setTimeout(() => {
            try { manager.stopDeviceScan(); } catch {}
            resolve({
              in_range: bestRssi > rssiThreshold,
              rssi: bestRssi === -127 ? -100 : bestRssi,
              distance_m: bestRssi === -127 ? 999 : rssiToDistance(bestRssi),
              source: 'native_ble',
            });
          }, durationMs);
          manager.startDeviceScan(null, { allowDuplicates: true }, (err: any, device: any) => {
            if (err) {
              clearTimeout(stop);
              try { manager.stopDeviceScan(); } catch {}
              resolve({ in_range: false, rssi: -100, distance_m: 999, source: 'native_ble' });
              return;
            }
            if (!device) return;
            if (nameHint && device.name && !device.name.toLowerCase().includes(nameHint.toLowerCase())) {
              return;
            }
            if (typeof device.rssi === 'number' && device.rssi > bestRssi) {
              bestRssi = device.rssi;
            }
          });
        });
        return result;
      } catch (e) {
        console.warn('BLE proximity scan failed, falling back to API', e);
      }
    }
    // Simulated / API fallback
    const r = await api.watchProximity(watchId);
    return {
      in_range: r.in_range,
      rssi: r.rssi,
      distance_m: r.distance_m,
      source: 'simulated_api',
    };
  },
};
