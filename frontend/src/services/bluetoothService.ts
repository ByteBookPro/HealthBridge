import { Platform } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';

// Types for Bluetooth and Sync
export interface BluetoothDevice {
  id: string;
  name: string;
  rssi: number; // Signal strength (-30 to -100, higher is better)
  battery: number;
  isConnected: boolean;
  lastSeen: Date;
  platform: 'apple' | 'samsung' | 'fitbit' | 'garmin' | 'other';
}

export interface SyncStatus {
  isConnected: boolean;
  isScanning: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncProgress: number; // 0-100
  connectedDevices: BluetoothDevice[];
  signalStrength: 'excellent' | 'good' | 'fair' | 'weak' | 'none';
}

export interface HealthSample {
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
}

// Check if we're in a native environment with BLE support
const isNativeWithBLE = Platform.OS !== 'web' && !__DEV__;

// Simulated BLE for Expo Go / Development
class SimulatedBLEManager {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectedDevices: BluetoothDevice[] = [];
  private isScanning = false;
  private syncInterval: NodeJS.Timer | null = null;

  constructor() {
    // Simulate periodic data updates
    this.startPeriodicSync();
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  async startScan(): Promise<BluetoothDevice[]> {
    this.isScanning = true;
    this.emit('scanStarted', {});

    // Simulate finding devices over time
    return new Promise((resolve) => {
      const devices: BluetoothDevice[] = [];
      
      // Simulate discovering devices
      setTimeout(() => {
        if (Math.random() > 0.3) {
          const device: BluetoothDevice = {
            id: 'apple-watch-1',
            name: 'Apple Watch',
            rssi: -45 + Math.floor(Math.random() * 15),
            battery: 75 + Math.floor(Math.random() * 25),
            isConnected: false,
            lastSeen: new Date(),
            platform: 'apple',
          };
          devices.push(device);
          this.emit('deviceFound', device);
        }
      }, 800);

      setTimeout(() => {
        if (Math.random() > 0.4) {
          const device: BluetoothDevice = {
            id: 'galaxy-watch-1',
            name: 'Galaxy Watch 6',
            rssi: -52 + Math.floor(Math.random() * 20),
            battery: 60 + Math.floor(Math.random() * 40),
            isConnected: false,
            lastSeen: new Date(),
            platform: 'samsung',
          };
          devices.push(device);
          this.emit('deviceFound', device);
        }
      }, 1500);

      setTimeout(() => {
        this.isScanning = false;
        this.emit('scanStopped', {});
        resolve(devices);
      }, 3000);
    });
  }

  async stopScan() {
    this.isScanning = false;
    this.emit('scanStopped', {});
  }

  async connect(deviceId: string): Promise<boolean> {
    this.emit('connecting', { deviceId });
    
    return new Promise((resolve) => {
      // Simulate connection time
      setTimeout(() => {
        const device: BluetoothDevice = {
          id: deviceId,
          name: deviceId.includes('apple') ? 'Apple Watch' : 'Galaxy Watch',
          rssi: -40 + Math.floor(Math.random() * 10),
          battery: 70 + Math.floor(Math.random() * 30),
          isConnected: true,
          lastSeen: new Date(),
          platform: deviceId.includes('apple') ? 'apple' : 'samsung',
        };
        
        this.connectedDevices.push(device);
        this.emit('connected', device);
        resolve(true);
      }, 1500);
    });
  }

  async disconnect(deviceId: string): Promise<void> {
    this.connectedDevices = this.connectedDevices.filter(d => d.id !== deviceId);
    this.emit('disconnected', { deviceId });
  }

  async syncData(): Promise<HealthSample[]> {
    this.emit('syncStarted', {});
    
    return new Promise((resolve) => {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10 + Math.floor(Math.random() * 15);
        if (progress > 100) progress = 100;
        this.emit('syncProgress', { progress });
        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 200);

      setTimeout(() => {
        clearInterval(progressInterval);
        
        const samples: HealthSample[] = [
          { metric: 'steps', value: 250 + Math.floor(Math.random() * 100), unit: 'steps', timestamp: new Date(), source: 'watch' },
          { metric: 'heart_rate', value: 68 + Math.floor(Math.random() * 15), unit: 'bpm', timestamp: new Date(), source: 'watch' },
          { metric: 'calories', value: 15 + Math.floor(Math.random() * 10), unit: 'kcal', timestamp: new Date(), source: 'watch' },
        ];
        
        this.emit('syncCompleted', { samples });
        resolve(samples);
      }, 2000);
    });
  }

  private startPeriodicSync() {
    // Simulate real-time data coming from watch
    this.syncInterval = setInterval(() => {
      if (this.connectedDevices.length > 0) {
        // Emit small updates periodically
        const sample: HealthSample = {
          metric: Math.random() > 0.5 ? 'heart_rate' : 'steps',
          value: Math.random() > 0.5 ? 68 + Math.floor(Math.random() * 20) : 5 + Math.floor(Math.random() * 15),
          unit: Math.random() > 0.5 ? 'bpm' : 'steps',
          timestamp: new Date(),
          source: this.connectedDevices[0].platform,
        };
        this.emit('realtimeData', sample);
        
        // Update device battery occasionally
        if (Math.random() > 0.9) {
          const device = this.connectedDevices[0];
          device.battery = Math.max(0, device.battery - 1);
          device.rssi = -35 - Math.floor(Math.random() * 25);
          device.lastSeen = new Date();
          this.emit('deviceUpdated', device);
        }
      }
    }, 5000);
  }

  getConnectedDevices(): BluetoothDevice[] {
    return this.connectedDevices;
  }

  getSignalStrength(): 'excellent' | 'good' | 'fair' | 'weak' | 'none' {
    if (this.connectedDevices.length === 0) return 'none';
    const avgRssi = this.connectedDevices.reduce((sum, d) => sum + d.rssi, 0) / this.connectedDevices.length;
    if (avgRssi > -50) return 'excellent';
    if (avgRssi > -60) return 'good';
    if (avgRssi > -70) return 'fair';
    return 'weak';
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
    this.connectedDevices = [];
  }
}

// Real BLE Manager for production builds
class RealBLEManager {
  // This would use react-native-ble-plx in a real implementation
  // For now, it delegates to simulated manager
  private simulated = new SimulatedBLEManager();

  on(event: string, callback: (data: any) => void) {
    return this.simulated.on(event, callback);
  }

  async startScan() {
    return this.simulated.startScan();
  }

  async stopScan() {
    return this.simulated.stopScan();
  }

  async connect(deviceId: string) {
    return this.simulated.connect(deviceId);
  }

  async disconnect(deviceId: string) {
    return this.simulated.disconnect(deviceId);
  }

  async syncData() {
    return this.simulated.syncData();
  }

  getConnectedDevices() {
    return this.simulated.getConnectedDevices();
  }

  getSignalStrength() {
    return this.simulated.getSignalStrength();
  }

  destroy() {
    this.simulated.destroy();
  }
}

// Singleton instance
let bleManagerInstance: SimulatedBLEManager | RealBLEManager | null = null;

export function getBLEManager(): SimulatedBLEManager | RealBLEManager {
  if (!bleManagerInstance) {
    bleManagerInstance = isNativeWithBLE ? new RealBLEManager() : new SimulatedBLEManager();
  }
  return bleManagerInstance;
}

// React Hook for Bluetooth/Sync Status
export function useBluetooth() {
  const [status, setStatus] = useState<SyncStatus>({
    isConnected: false,
    isScanning: false,
    isSyncing: false,
    lastSyncTime: null,
    syncProgress: 0,
    connectedDevices: [],
    signalStrength: 'none',
  });
  
  const [realtimeData, setRealtimeData] = useState<HealthSample | null>(null);
  const bleManager = useRef(getBLEManager());

  useEffect(() => {
    const manager = bleManager.current;
    
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      manager.on('scanStarted', () => setStatus(s => ({ ...s, isScanning: true }))),
      manager.on('scanStopped', () => setStatus(s => ({ ...s, isScanning: false }))),
      manager.on('deviceFound', (device: BluetoothDevice) => {
        setStatus(s => ({
          ...s,
          connectedDevices: [...s.connectedDevices.filter(d => d.id !== device.id), device],
        }));
      }),
      manager.on('connecting', () => setStatus(s => ({ ...s, isSyncing: true }))),
      manager.on('connected', (device: BluetoothDevice) => {
        setStatus(s => ({
          ...s,
          isConnected: true,
          isSyncing: false,
          connectedDevices: s.connectedDevices.map(d => 
            d.id === device.id ? { ...d, isConnected: true } : d
          ),
          signalStrength: manager.getSignalStrength(),
        }));
      }),
      manager.on('disconnected', ({ deviceId }) => {
        setStatus(s => ({
          ...s,
          connectedDevices: s.connectedDevices.filter(d => d.id !== deviceId),
          isConnected: s.connectedDevices.filter(d => d.id !== deviceId).some(d => d.isConnected),
          signalStrength: manager.getSignalStrength(),
        }));
      }),
      manager.on('syncStarted', () => setStatus(s => ({ ...s, isSyncing: true, syncProgress: 0 }))),
      manager.on('syncProgress', ({ progress }) => setStatus(s => ({ ...s, syncProgress: progress }))),
      manager.on('syncCompleted', () => {
        setStatus(s => ({
          ...s,
          isSyncing: false,
          syncProgress: 100,
          lastSyncTime: new Date(),
        }));
      }),
      manager.on('realtimeData', (sample: HealthSample) => {
        setRealtimeData(sample);
      }),
      manager.on('deviceUpdated', (device: BluetoothDevice) => {
        setStatus(s => ({
          ...s,
          connectedDevices: s.connectedDevices.map(d => 
            d.id === device.id ? device : d
          ),
          signalStrength: manager.getSignalStrength(),
        }));
      }),
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const startScan = useCallback(async () => {
    return bleManager.current.startScan();
  }, []);

  const stopScan = useCallback(async () => {
    return bleManager.current.stopScan();
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    return bleManager.current.connect(deviceId);
  }, []);

  const disconnect = useCallback(async (deviceId: string) => {
    return bleManager.current.disconnect(deviceId);
  }, []);

  const syncData = useCallback(async () => {
    return bleManager.current.syncData();
  }, []);

  return {
    status,
    realtimeData,
    startScan,
    stopScan,
    connect,
    disconnect,
    syncData,
  };
}

// Format last sync time in a friendly way
export function formatLastSync(date: Date | null): string {
  if (!date) return 'Never';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

// Signal strength to icon/color helper
export function getSignalInfo(strength: SyncStatus['signalStrength']): { icon: string; color: string; bars: number } {
  switch (strength) {
    case 'excellent': return { icon: 'wifi', color: '#10B981', bars: 4 };
    case 'good': return { icon: 'wifi', color: '#22C55E', bars: 3 };
    case 'fair': return { icon: 'wifi', color: '#F59E0B', bars: 2 };
    case 'weak': return { icon: 'wifi', color: '#EF4444', bars: 1 };
    default: return { icon: 'wifi-outline', color: '#64748B', bars: 0 };
  }
}
