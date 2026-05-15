import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import GlassCard from './GlassCard';
import Sparkline from './Sparkline';
import type { MetricSummary } from '@/src/api/client';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  steps: 'footsteps-outline',
  heart_rate: 'heart-outline',
  sleep: 'moon-outline',
  workouts: 'barbell-outline',
  spo2: 'water-outline',
  ecg: 'pulse-outline',
  calories: 'flame-outline',
  stand: 'body-outline',
};

const COLOR_BY_METRIC: Record<string, string> = {
  steps: '#2DD4BF',
  heart_rate: '#EF4444',
  sleep: '#8B5CF6',
  workouts: '#F59E0B',
  spo2: '#3B82F6',
  ecg: '#EC4899',
  calories: '#F97316',
  stand: '#10B981',
};

function fmt(n: number, unit: string): string {
  if (unit === 'steps' || unit === 'kcal') return Math.round(n).toLocaleString();
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function MetricCard({ m, testID }: { m: MetricSummary; testID?: string }) {
  const color = COLOR_BY_METRIC[m.metric] ?? theme.colors.teal;
  const positive = m.delta_pct >= 0;
  return (
    <GlassCard style={styles.card} testID={testID}>
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
          <Ionicons name={ICONS[m.metric] ?? 'analytics-outline'} size={18} color={color} />
        </View>
        <View style={styles.platforms}>
          {m.apple_value != null && (
            <View style={[styles.badge, { backgroundColor: 'rgba(243,244,246,0.12)' }]}>
              <Ionicons name="logo-apple" size={10} color={theme.colors.apple} />
            </View>
          )}
          {m.samsung_value != null && (
            <View style={[styles.badge, { backgroundColor: 'rgba(59,130,246,0.16)' }]}>
              <Ionicons name="phone-portrait-outline" size={10} color={theme.colors.samsung} />
            </View>
          )}
        </View>
      </View>
      <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 6 }}>{m.label}</AppText>
      <View style={styles.valueRow}>
        <AppText weight="heading" size={28} style={{ letterSpacing: -1 }}>
          {fmt(m.current, m.unit)}
        </AppText>
        <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 6, marginBottom: 4 }}>
          {m.unit}
        </AppText>
      </View>
      <View style={styles.footer}>
        <View style={styles.spark}>
          <Sparkline data={m.trend} color={color} width={100} height={28} />
        </View>
        <View style={[styles.delta, { backgroundColor: positive ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)' }]}>
          <Ionicons
            name={positive ? 'trending-up' : 'trending-down'}
            size={10}
            color={positive ? theme.colors.emerald : theme.colors.danger}
          />
          <AppText
            size={10}
            weight="semi"
            color={positive ? theme.colors.emerald : theme.colors.danger}
            style={{ marginLeft: 4 }}
          >
            {Math.abs(m.delta_pct).toFixed(1)}%
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 160, padding: theme.space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  platforms: { flexDirection: 'row', gap: 4 },
  badge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  spark: { flex: 1 },
  delta: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
});
