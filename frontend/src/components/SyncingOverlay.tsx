import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing, cancelAnimation, interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';

type Props = {
  visible: boolean;
  label?: string;
  subtitle?: string;
  progress?: number;        // 0..1 if known; otherwise indeterminate
  onCancel?: () => void;    // optional cancel handler
};

/**
 * SyncingOverlay — full-screen animated overlay shown during data sync
 * between watches/connectors and the HealthBridge vault. Three concentric
 * pulsing rings, a rotating arc, and an animated source→destination flow
 * tell the user "data is moving right now".
 */
export default function SyncingOverlay({ visible, label, subtitle, progress, onCancel }: Props) {
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(0);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(rotate);
      cancelAnimation(pulse);
      cancelAnimation(flow);
      return;
    }
    rotate.value = 0;
    pulse.value = 0;
    flow.value = 0;
    rotate.value = withRepeat(withTiming(360, { duration: 1800, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    flow.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [visible, rotate, pulse, flow]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.6]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => {
    const v = (pulse.value + 0.33) % 1;
    return {
      transform: [{ scale: interpolate(v, [0, 1], [0.9, 1.6]) }],
      opacity: interpolate(v, [0, 1], [0.45, 0]),
    };
  });
  const ring3Style = useAnimatedStyle(() => {
    const v = (pulse.value + 0.66) % 1;
    return {
      transform: [{ scale: interpolate(v, [0, 1], [0.9, 1.6]) }],
      opacity: interpolate(v, [0, 1], [0.35, 0]),
    };
  });

  const flowAStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(flow.value, [0, 1], [-60, 60]) }],
    opacity: interpolate(flow.value, [0, 0.5, 1], [0, 1, 0]),
  }));
  const flowBStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(flow.value, [0, 1], [60, -60]) }],
    opacity: interpolate(flow.value, [0, 0.5, 1], [0, 1, 0]),
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.root} testID="syncing-overlay">
          <View style={styles.center}>
            {/* Pulsing rings */}
            <Animated.View style={[styles.ring, ring1Style]} pointerEvents="none" />
            <Animated.View style={[styles.ring, ring2Style]} pointerEvents="none" />
            <Animated.View style={[styles.ring, ring3Style]} pointerEvents="none" />

            {/* Rotating arc */}
            <Animated.View style={[styles.arcBox, arcStyle]} pointerEvents="none">
              <View style={styles.arc} />
            </Animated.View>

            {/* Source → Destination flow */}
            <View style={styles.flowRow} pointerEvents="none">
              <View style={[styles.flowDot, { backgroundColor: theme.colors.apple }]}>
                <Ionicons name="logo-apple" size={16} color="#000" />
              </View>
              <View style={styles.flowLine}>
                <Animated.View style={[styles.flowParticle, flowAStyle, { backgroundColor: theme.colors.teal }]} />
                <Animated.View style={[styles.flowParticle, flowBStyle, { backgroundColor: theme.colors.samsung }]} />
              </View>
              <View style={[styles.flowDot, { backgroundColor: theme.colors.samsung }]}>
                <Ionicons name="phone-portrait" size={14} color="#fff" />
              </View>
            </View>

            <View style={styles.coreBadge}>
              <LinearGradient
                colors={[theme.colors.teal, theme.colors.emerald]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.coreBadgeGrad}
              >
                <Ionicons name="sync" size={28} color="#fff" />
              </LinearGradient>
            </View>
          </View>

          <AppText weight="heading" size={20} style={{ marginTop: 36, textAlign: 'center' }}>
            {label || 'Syncing your health data'}
          </AppText>
          <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
            {subtitle || 'Bridging metrics between connected watches and apps…'}
          </AppText>

          {typeof progress === 'number' && (
            <View style={styles.progressTrack} testID="syncing-progress">
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}

          {onCancel && (
            <Pressable onPress={onCancel} style={styles.cancelBtn} testID="syncing-cancel">
              <AppText size={12} color={theme.colors.textDim}>Hide</AppText>
            </Pressable>
          )}
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space.xl },
  center: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: 'rgba(45,212,191,0.6)',
  },
  arcBox: { position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  arc: {
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 3, borderTopColor: theme.colors.teal,
    borderRightColor: 'rgba(45,212,191,0.18)',
    borderBottomColor: 'rgba(45,212,191,0.08)',
    borderLeftColor: 'rgba(45,212,191,0.18)',
  },
  flowRow: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center',
    width: 180, justifyContent: 'space-between',
  },
  flowDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  flowLine: {
    flex: 1, height: 2, marginHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1, overflow: 'visible', justifyContent: 'center',
  },
  flowParticle: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4, top: -3,
  },
  coreBadge: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden' },
  coreBadgeGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    marginTop: 20, width: 220, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.teal, borderRadius: 2 },
  cancelBtn: { marginTop: 24, paddingVertical: 8, paddingHorizontal: 20 },
});
