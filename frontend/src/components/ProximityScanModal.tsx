import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  cancelAnimation, Easing, interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import PrimaryButton from './PrimaryButton';
import { api, type WatchProximity } from '@/src/api/client';

type Props = {
  visible: boolean;
  watchId: string | null;
  watchName: string;
  onClose: () => void;
  onProceed: (result: WatchProximity) => void;
};

/**
 * ProximityScanModal — animated BLE-style proximity scan before a watch can
 * be connected. Polls /api/watches/{id}/proximity and only enables the
 * "Proceed" button if the watch is in range.
 */
export default function ProximityScanModal({ visible, watchId, watchName, onClose, onProceed }: Props) {
  const [result, setResult] = useState<WatchProximity | null>(null);
  const [scanning, setScanning] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const ring = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(ring);
      cancelAnimation(sweep);
      setResult(null);
      setScanning(false);
      setAttempts(0);
      return;
    }
    ring.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    sweep.value = withRepeat(withTiming(360, { duration: 2200, easing: Easing.linear }), -1, false);
    // Auto-start first scan
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const runScan = async () => {
    if (!watchId) return;
    setScanning(true);
    setResult(null);
    setAttempts((n) => n + 1);
    try {
      // Show scanning animation for at least 1.4s
      const [r] = await Promise.all([
        api.watchProximity(watchId),
        new Promise((res) => setTimeout(res, 1400)),
      ]);
      setResult(r);
    } catch {
      setResult({ watch_id: watchId, in_range: false, rssi: -100, distance_m: 999, scanned_at: '' });
    } finally {
      setScanning(false);
    }
  };

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.6, 1.6]) }],
    opacity: interpolate(ring.value, [0, 1], [0.6, 0]),
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value}deg` }],
  }));

  const inRange = result?.in_range === true;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.root} testID="proximity-modal">
          <View style={styles.card}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10} testID="proximity-close">
              <Ionicons name="close" size={20} color={theme.colors.textDim} />
            </Pressable>

            <View style={styles.radar}>
              <Animated.View style={[styles.ringPulse, ringStyle]} pointerEvents="none" />
              <View style={styles.radarRing} />
              <View style={[styles.radarRing, { width: 100, height: 100, borderRadius: 50 }]} />
              <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(45,212,191,0)', 'rgba(45,212,191,0.5)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.sweepGrad}
                />
              </Animated.View>
              <View style={styles.radarCore}>
                <Ionicons name="watch" size={28} color={theme.colors.teal} />
              </View>
            </View>

            <AppText weight="heading" size={20} style={{ marginTop: 24, textAlign: 'center' }}>
              {scanning ? 'Scanning…' : inRange ? 'Watch detected' : (result ? 'Out of range' : 'Scanning…')}
            </AppText>
            <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 6, textAlign: 'center' }}>
              {scanning
                ? `Looking for ${watchName} over Bluetooth LE`
                : inRange
                  ? `${watchName} is ${result?.distance_m}m away`
                  : (result ? 'Bring the watch closer and try again' : 'Initializing radar')}
            </AppText>

            {result && (
              <View style={styles.metaRow} testID="proximity-result">
                <Stat label="RSSI" value={`${result.rssi} dBm`} />
                <View style={styles.divider} />
                <Stat label="Distance" value={inRange ? `${result.distance_m} m` : '—'} />
                <View style={styles.divider} />
                <Stat label="Status" value={inRange ? 'IN RANGE' : 'OUT'} highlight={inRange} />
              </View>
            )}

            <View style={{ height: 20 }} />
            <PrimaryButton
              title={inRange ? 'Connect Watch' : (scanning ? 'Scanning…' : 'Scan Again')}
              onPress={() => {
                if (inRange && result) onProceed(result);
                else void runScan();
              }}
              disabled={scanning || (!inRange && !result)}
              loading={scanning}
              icon={<Ionicons name={inRange ? 'checkmark' : 'refresh'} size={16} color="#fff" />}
              testID="proximity-action-btn"
            />
            {attempts > 0 && !scanning && !inRange && (
              <AppText size={10} color={theme.colors.textMute} style={{ textAlign: 'center', marginTop: 8 }}>
                Tip: most watches need to be within 5m for reliable pairing.
              </AppText>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <AppText size={9} color={theme.colors.textMute} style={{ letterSpacing: 1 }}>
        {label}
      </AppText>
      <AppText
        weight="semi" size={12}
        color={highlight ? theme.colors.emerald : theme.colors.text}
        style={{ marginTop: 2 }}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space.lg },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: theme.colors.bg2,
    borderRadius: 24, padding: theme.space.lg,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  radar: {
    width: 180, height: 180, alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  radarRing: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.18)',
  },
  ringPulse: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: 'rgba(45,212,191,0.6)',
  },
  sweep: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  sweepGrad: { width: 80, height: 2 },
  radarCore: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(45,212,191,0.16)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 18, width: '100%',
    paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 22, backgroundColor: theme.colors.border },
});
