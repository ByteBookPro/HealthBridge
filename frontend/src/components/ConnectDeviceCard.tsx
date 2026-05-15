import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import GlassCard from './GlassCard';

interface ConnectedDevice {
  id: string;
  name: string;
  platform: 'apple' | 'samsung' | 'fitbit' | 'garmin' | 'google' | 'xiaomi';
  connected: boolean;
  battery?: number;
  lastSync?: string;
}

interface ConnectDeviceCardProps {
  devices: ConnectedDevice[];
  onAddDevice: () => void;
  testID?: string;
}

const PLATFORM_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  apple: { icon: 'watch-outline', color: '#F3F4F6' },
  samsung: { icon: 'watch-outline', color: '#3B82F6' },
  fitbit: { icon: 'fitness-outline', color: '#00B0B9' },
  garmin: { icon: 'navigate-outline', color: '#007DC3' },
  google: { icon: 'logo-google', color: '#EA4335' },
  xiaomi: { icon: 'watch-outline', color: '#FF6900' },
};

export default function ConnectDeviceCard({ devices, onAddDevice, testID }: ConnectDeviceCardProps) {
  const router = useRouter();
  const connectedDevices = devices.filter(d => d.connected);

  return (
    <GlassCard style={styles.card} testID={testID}>
      <View style={styles.header}>
        <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.headerLabel}>
          CONNECTED DEVICES
        </AppText>
        <Pressable onPress={onAddDevice} style={styles.addBtn}>
          <Ionicons name="add" size={16} color={theme.colors.teal} />
          <AppText size={11} weight="semi" color={theme.colors.teal} style={{ marginLeft: 4 }}>
            Add
          </AppText>
        </Pressable>
      </View>

      {connectedDevices.length === 0 ? (
        <Pressable onPress={onAddDevice} style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="watch-outline" size={32} color={theme.colors.textMute} />
          </View>
          <AppText size={13} weight="med" style={{ marginTop: 12 }}>
            Connect Your First Device
          </AppText>
          <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 4, textAlign: 'center' }}>
            Tap here to connect your smartwatch, fitness tracker, or health app
          </AppText>
          <View style={styles.connectBtn}>
            <LinearGradient
              colors={theme.gradients.primaryBtn as any}
              style={styles.connectBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="bluetooth" size={14} color="#fff" />
              <AppText size={12} weight="semi" color="#fff" style={{ marginLeft: 6 }}>
                Connect Device
              </AppText>
            </LinearGradient>
          </View>
        </Pressable>
      ) : (
        <View style={styles.deviceList}>
          {connectedDevices.map((device, idx) => {
            const platformInfo = PLATFORM_ICONS[device.platform] || PLATFORM_ICONS.apple;
            return (
              <View key={device.id} style={[styles.deviceItem, idx < connectedDevices.length - 1 && styles.deviceDivider]}>
                <View style={[styles.deviceIcon, { backgroundColor: `${platformInfo.color}22` }]}>
                  <Ionicons name={platformInfo.icon} size={18} color={platformInfo.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText weight="med" size={13}>{device.name}</AppText>
                  <View style={styles.deviceMeta}>
                    <View style={styles.statusDot} />
                    <AppText size={10} color={theme.colors.textDim}>Connected</AppText>
                    {device.battery && (
                      <>
                        <View style={styles.metaDot} />
                        <Ionicons name="battery-half" size={10} color={theme.colors.textDim} />
                        <AppText size={10} color={theme.colors.textDim} style={{ marginLeft: 2 }}>
                          {device.battery}%
                        </AppText>
                      </>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMute} />
              </View>
            );
          })}
          
          {/* Add more devices link */}
          <Pressable onPress={onAddDevice} style={styles.addMoreRow}>
            <View style={[styles.deviceIcon, { backgroundColor: 'rgba(45,212,191,0.12)' }]}>
              <Ionicons name="add" size={18} color={theme.colors.teal} />
            </View>
            <AppText size={12} color={theme.colors.teal} style={{ marginLeft: 12 }}>
              Connect another device
            </AppText>
          </Pressable>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLabel: {
    letterSpacing: 1.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.3)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    marginTop: 16,
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  deviceList: {},
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  deviceDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.emerald,
    marginRight: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textMute,
    marginHorizontal: 6,
  },
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
});
