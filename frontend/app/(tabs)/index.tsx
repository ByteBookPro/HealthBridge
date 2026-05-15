import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import ActivityRings from '@/src/components/ActivityRings';
import MetricCard from '@/src/components/MetricCard';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api, type MetricSummary, type Watch } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([api.metrics(), api.watches()]);
      setMetrics(m);
      setWatches(w);
      if (w.length) setLastSync(w[0].last_sync_at);
    } catch (e) {
      // silent
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.syncNow();
      await load();
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const findMetric = (k: string) => metrics.find((x) => x.metric === k);
  const calories = findMetric('calories');
  const workouts = findMetric('workouts');
  const stand = findMetric('stand');

  const rings = [
    { progress: calories ? Math.min(1, calories.current / calories.goal) : 0, colorFrom: '#F97316', colorTo: '#EF4444' },
    { progress: workouts ? Math.min(1, workouts.current / workouts.goal) : 0, colorFrom: '#10B981', colorTo: '#2DD4BF' },
    { progress: stand ? Math.min(1, stand.current / stand.goal) : 0, colorFrom: '#3B82F6', colorTo: '#8B5CF6' },
  ];

  const apple = watches.find((w) => w.platform === 'apple');
  const samsung = watches.find((w) => w.platform === 'samsung');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <View style={styles.root} testID="dashboard-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.teal} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <AppText size={12} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {greeting}
              </AppText>
              <AppText weight="heading" size={26} style={{ letterSpacing: -0.5, marginTop: 2 }}>
                {user?.name || 'You'}
              </AppText>
            </View>
            <Pressable
              onPress={triggerSync}
              style={styles.syncBtn}
              testID="dashboard-sync-now-btn"
              hitSlop={8}
            >
              <Ionicons name="sync" size={16} color={theme.colors.teal} style={syncing ? { opacity: 0.5 } : undefined} />
              <AppText size={11} weight="semi" color={theme.colors.teal} style={{ marginLeft: 6 }}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </AppText>
            </Pressable>
          </View>

          {/* PRO AI Insights teaser */}
          <Pressable onPress={() => router.push('/insights')} testID="open-insights">
            <GlassCard glow style={{ marginTop: theme.space.md, padding: theme.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.aiBadge]}>
                  <Ionicons name="sparkles" size={18} color={theme.colors.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText weight="semi" size={14}>AI Health Insights</AppText>
                    <View style={styles.proTag}>
                      <AppText size={9} weight="bold" color={theme.colors.teal}>PRO</AppText>
                    </View>
                  </View>
                  <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                    Tap for personalized weekly findings & goals progress.
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
              </View>
            </GlassCard>
          </Pressable>

          {/* Bridge status */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} glow testID="bridge-status-card">
              <View style={styles.bridgeRow}>
                <PlatformBadge
                  active={!!apple?.connected}
                  icon="logo-apple"
                  label="Apple"
                  color={theme.colors.apple}
                />
                <View style={styles.bridgePath}>
                  <LinearGradient
                    colors={theme.gradients.bridge as any}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.bridgeLine}
                  />
                  <View style={styles.bridgeDot}>
                    <Ionicons name="shield-checkmark" size={12} color={theme.colors.teal} />
                  </View>
                </View>
                <PlatformBadge
                  active={!!samsung?.connected}
                  icon="phone-portrait"
                  label="Samsung"
                  color={theme.colors.samsung}
                />
              </View>
              <View style={styles.bridgeStatus}>
                <View style={styles.statusDot} />
                <AppText size={11} color={theme.colors.textDim}>
                  Bridge active · Last sync {lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Rings + summary */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} testID="rings-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Activity Rings · Unified
              </AppText>
              <View style={styles.ringsRow}>
                <ActivityRings size={170} rings={rings} thickness={14} />
                <View style={{ flex: 1, marginLeft: theme.space.md, gap: 14 }}>
                  <RingLine label="Move" value={calories ? `${Math.round(calories.current)}` : '—'} unit="kcal" colorFrom="#F97316" colorTo="#EF4444" />
                  <RingLine label="Exercise" value={workouts ? `${Math.round(workouts.current)}` : '—'} unit="min" colorFrom="#10B981" colorTo="#2DD4BF" />
                  <RingLine label="Stand" value={stand ? `${Math.round(stand.current)}` : '—'} unit="hr" colorFrom="#3B82F6" colorTo="#8B5CF6" />
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Metric grid */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            All Metrics
          </AppText>
          <View style={styles.grid}>
            {metrics
              .filter((m) => !['calories', 'workouts', 'stand'].includes(m.metric))
              .map((m) => (
                <View key={m.metric} style={styles.cell}>
                  <MetricCard m={m} testID={`metric-${m.metric}`} />
                </View>
              ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PlatformBadge({ active, icon, label, color }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={[styles.pBadge, { borderColor: active ? `${color}55` : theme.colors.border }]}>
      <View style={[styles.pIcon, { backgroundColor: active ? `${color}22` : 'rgba(255,255,255,0.04)' }]}>
        <Ionicons name={icon} size={18} color={active ? color : theme.colors.textMute} />
      </View>
      <AppText weight="semi" size={12} style={{ marginTop: 6 }}>{label}</AppText>
      <AppText size={10} color={active ? theme.colors.emerald : theme.colors.textMute} style={{ marginTop: 2 }}>
        {active ? 'Connected' : 'Offline'}
      </AppText>
    </View>
  );
}

function RingLine({ label, value, unit, colorFrom, colorTo }: { label: string; value: string; unit: string; colorFrom: string; colorTo: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LinearGradient
        colors={[colorFrom, colorTo]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 8, height: 32, borderRadius: 4 }}
      />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <AppText size={11} color={theme.colors.textDim}>{label}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <AppText weight="heading" size={18}>{value}</AppText>
          <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 4 }}>{unit}</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg, paddingTop: theme.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space.sm },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  aiBadge: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  proTag: { backgroundColor: 'rgba(45,212,191,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  bridgeRow: { flexDirection: 'row', alignItems: 'center' },
  pBadge: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 16, borderWidth: 1,
  },
  pIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bridgePath: { flex: 1.4, alignItems: 'center', justifyContent: 'center', height: 60, marginHorizontal: 6 },
  bridgeLine: { height: 2, width: '100%', borderRadius: 1 },
  bridgeDot: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.bg2,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  bridgeStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'center' },
  statusDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.emerald,
    marginRight: 6,
  },
  ringsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  sectionLabel: { marginTop: theme.space.lg, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  cell: { width: '48.5%' },
});
