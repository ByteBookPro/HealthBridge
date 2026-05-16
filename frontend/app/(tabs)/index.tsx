import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import ActivityRings from '@/src/components/ActivityRings';
import Sparkline from '@/src/components/Sparkline';
import AuroraBackground from '@/src/components/AuroraBackground';
import ConnectDeviceCard from '@/src/components/ConnectDeviceCard';
import { api, type MetricSummary, type Watch, type CategoriesResponse, type MetricAvailabilityResponse } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import SyncingOverlay from '@/src/components/SyncingOverlay';
import { useDevice } from '@/src/hooks/useDevice';

// Metric icons mapping
const METRIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  steps: 'footsteps-outline',
  distance: 'map-outline',
  active_minutes: 'timer-outline',
  floors: 'trending-up-outline',
  calories: 'flame-outline',
  stand: 'body-outline',
  workouts: 'barbell-outline',
  workout_count: 'fitness-outline',
  vo2_max: 'speedometer-outline',
  training_load: 'analytics-outline',
  recovery_time: 'hourglass-outline',
  calorie_intake: 'restaurant-outline',
  protein: 'fish-outline',
  carbs: 'leaf-outline',
  fat: 'water-outline',
  water: 'water-outline',
  fiber: 'nutrition-outline',
  weight: 'scale-outline',
  bmi: 'calculator-outline',
  body_fat: 'pie-chart-outline',
  muscle_mass: 'fitness-outline',
  sleep: 'moon-outline',
  sleep_quality: 'star-outline',
  heart_rate: 'heart-outline',
  resting_hr: 'heart-outline',
  hrv: 'pulse-outline',
  blood_pressure_sys: 'speedometer-outline',
  blood_pressure_dia: 'speedometer-outline',
  spo2: 'water-outline',
  respiratory_rate: 'cloudy-outline',
  body_temp: 'thermometer-outline',
  ecg: 'pulse-outline',
  stress: 'sad-outline',
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  activity: '#2DD4BF',
  exercise: '#F59E0B',
  nutrition: '#10B981',
  body: '#8B5CF6',
  vitals: '#EF4444',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  activity: 'walk-outline',
  exercise: 'barbell-outline',
  nutrition: 'nutrition-outline',
  body: 'body-outline',
  vitals: 'heart-outline',
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { deviceId } = useDevice();
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [categories, setCategories] = useState<CategoriesResponse | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [availability, setAvailability] = useState<MetricAvailabilityResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['activity', 'vitals']));

  const load = useCallback(async () => {
    try {
      const [m, w, cats, avail] = await Promise.all([
        api.metricsAll(),
        api.watches(),
        api.metricsCategories(),
        api.metricAvailability(deviceId || undefined).catch(() => null),
      ]);
      setMetrics(m);
      setWatches(w);
      setCategories(cats);
      if (avail) setAvailability(avail);
    } catch (e) {
      // Fallback to basic metrics
      try {
        const [m, w] = await Promise.all([api.metrics(), api.watches()]);
        setMetrics(m);
        setWatches(w);
      } catch {}
    }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    try {
      await api.syncNow();
      await load();
    } catch {}
    setSyncing(false);
    setRefreshing(false);
  }, [load]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group metrics by category
  const metricsByCategory = metrics.reduce((acc, m) => {
    const cat = m.category || 'activity';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {} as Record<string, MetricSummary[]>);

  // Get key metrics for rings
  const findMetric = (k: string) => metrics.find((x) => x.metric === k);
  const caloriesMetric = findMetric('calories');
  const workoutsMetric = findMetric('workouts');
  const stepsMetric = findMetric('steps');

  const rings = [
    { progress: caloriesMetric ? Math.min(1, caloriesMetric.current / caloriesMetric.goal) : 0, colorFrom: '#F97316', colorTo: '#EF4444' },
    { progress: workoutsMetric ? Math.min(1, workoutsMetric.current / workoutsMetric.goal) : 0, colorFrom: '#10B981', colorTo: '#2DD4BF' },
    { progress: stepsMetric ? Math.min(1, stepsMetric.current / stepsMetric.goal) : 0, colorFrom: '#3B82F6', colorTo: '#8B5CF6' },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const connectedDevices = watches.filter(w => w.connected).map(w => ({
    id: w.id,
    name: w.model,
    platform: w.platform as any,
    connected: w.connected,
    battery: w.battery,
    lastSync: w.last_sync_at,
  }));

  const categoryOrder = ['activity', 'vitals', 'exercise', 'body', 'nutrition'];

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
              onPress={() => router.push('/insights')}
              style={styles.insightBtn}
              hitSlop={8}
            >
              <Ionicons name="sparkles" size={18} color={theme.colors.teal} />
            </Pressable>
          </View>

          {/* No-connectors CTA: shown when the user has not connected any
              data sources yet — metrics stay locked until at least one
              connector starts providing data. */}
          {availability && availability.total_connected === 0 && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <Pressable onPress={() => router.push('/app-connectors')} testID="dashboard-connect-cta">
                <GlassCard glow style={styles.connectBanner}>
                  <LinearGradient
                    colors={['rgba(45,212,191,0.18)', 'rgba(45,212,191,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.connectBannerIcon}>
                      <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.teal} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText weight="semi" size={14}>Connect a data source</AppText>
                      <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                        Metrics stay locked until an app starts providing data.
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
                  </View>
                </GlassCard>
              </Pressable>
            </Animated.View>
          )}

          {/* Connect Device Card - Clean button to connect watches */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <ConnectDeviceCard
              devices={connectedDevices}
              onAddDevice={() => router.push('/setup')}
              testID="connect-device-card"
            />
          </Animated.View>

          {/* Activity Rings Summary */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable onPress={() => router.push('/metric/steps')}>
              <GlassCard style={{ marginTop: theme.space.md }} testID="rings-card">
                <AppText size={11} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Today's Progress
                </AppText>
                <View style={styles.ringsRow}>
                  <ActivityRings size={140} rings={rings} thickness={12} />
                  <View style={{ flex: 1, marginLeft: theme.space.md, gap: 10 }}>
                    <RingLine
                      label="Calories"
                      value={caloriesMetric ? `${Math.round(caloriesMetric.current)}` : '—'}
                      goal={caloriesMetric?.goal || 2200}
                      unit="kcal"
                      colorFrom="#F97316"
                      colorTo="#EF4444"
                    />
                    <RingLine
                      label="Exercise"
                      value={workoutsMetric ? `${Math.round(workoutsMetric.current)}` : '—'}
                      goal={workoutsMetric?.goal || 60}
                      unit="min"
                      colorFrom="#10B981"
                      colorTo="#2DD4BF"
                    />
                    <RingLine
                      label="Steps"
                      value={stepsMetric ? `${Math.round(stepsMetric.current / 1000)}k` : '—'}
                      goal={stepsMetric?.goal || 10000}
                      unit="steps"
                      colorFrom="#3B82F6"
                      colorTo="#8B5CF6"
                    />
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>

          {/* AI Insights teaser */}
          <Pressable onPress={() => router.push('/insights')} testID="open-insights">
            <Animated.View entering={FadeInDown.delay(120).duration(400)}>
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
                      Personalized health analysis & recommendations
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
                </View>
              </GlassCard>
            </Animated.View>
          </Pressable>

          {/* Health Metrics by Category */}
          {categoryOrder.map((catId, catIdx) => {
            const catMetrics = metricsByCategory[catId] || [];
            if (catMetrics.length === 0) return null;
            
            const isExpanded = expandedCategories.has(catId);
            const catColor = CATEGORY_COLORS[catId] || '#2DD4BF';
            const catIcon = CATEGORY_ICONS[catId] || 'fitness-outline';
            const catLabel = catId.charAt(0).toUpperCase() + catId.slice(1);

            return (
              <Animated.View key={catId} entering={FadeInDown.delay(160 + catIdx * 40).duration(400)}>
                {/* Category Header */}
                <Pressable onPress={() => toggleCategory(catId)} style={styles.categoryHeader}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}>
                    <Ionicons name={catIcon} size={16} color={catColor} />
                  </View>
                  <AppText weight="semi" size={14} style={{ flex: 1, marginLeft: 10 }}>
                    {catLabel}
                  </AppText>
                  <AppText size={11} color={theme.colors.textMute} style={{ marginRight: 8 }}>
                    {catMetrics.length} metrics
                  </AppText>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.textMute}
                  />
                </Pressable>

                {/* Metrics Grid */}
                {isExpanded && (
                  <View style={styles.metricsGrid}>
                    {catMetrics.map((m, idx) => {
                      const avail = availability?.metrics?.[m.metric];
                      // Until at least one connector is connected, treat all
                      // metrics as locked. Once connectors exist, only show
                      // a metric as live if a connected provider supplies it.
                      const isLocked = availability != null && !avail?.available;
                      return (
                      <Animated.View key={m.metric} entering={FadeInRight.delay(idx * 30).duration(300)} style={styles.metricCell}>
                        <Pressable
                          onPress={() => {
                            if (isLocked) router.push('/app-connectors');
                            else router.push(`/metric/${m.metric}`);
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                          testID={`metric-card-${m.metric}`}
                        >
                          <GlassCard style={[styles.metricCard, isLocked && styles.metricLocked]}>
                            <View style={styles.metricHeader}>
                              <View style={[styles.metricIcon, { backgroundColor: `${catColor}18`, borderColor: `${catColor}40` }]}>
                                <Ionicons name={METRIC_ICONS[m.metric] || 'analytics-outline'} size={14} color={isLocked ? theme.colors.textMute : catColor} />
                              </View>
                              {/* Source badges */}
                              <View style={styles.sourceBadges}>
                                {isLocked ? (
                                  <View style={styles.lockBadge}>
                                    <Ionicons name="lock-closed" size={8} color={theme.colors.textMute} />
                                  </View>
                                ) : (
                                  <>
                                    {m.apple_value != null && (
                                      <View style={styles.sourceBadge}>
                                        <Ionicons name="logo-apple" size={8} color="#F3F4F6" />
                                      </View>
                                    )}
                                    {m.samsung_value != null && (
                                      <View style={[styles.sourceBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                                        <Ionicons name="phone-portrait" size={8} color="#3B82F6" />
                                      </View>
                                    )}
                                  </>
                                )}
                              </View>
                            </View>
                            <AppText size={9} color={theme.colors.textDim} numberOfLines={1} style={{ marginTop: 4 }}>
                              {m.label}
                            </AppText>
                            <View style={styles.metricValue}>
                              <AppText weight="heading" size={18} style={{ letterSpacing: -0.5, color: isLocked ? theme.colors.textMute : theme.colors.text }}>
                                {isLocked ? '—' : formatValue(m.current, m.unit)}
                              </AppText>
                              <AppText size={9} color={theme.colors.textMute} style={{ marginLeft: 2, marginBottom: 1 }}>
                                {m.unit}
                              </AppText>
                            </View>
                            {/* Sparkline (only when available) */}
                            {!isLocked && m.trend && m.trend.length > 0 && (
                              <View style={styles.sparkContainer}>
                                <Sparkline data={m.trend} color={catColor} width={70} height={18} />
                              </View>
                            )}
                            {/* Connect-CTA chip when locked */}
                            {isLocked && (
                              <View style={styles.connectCta} testID={`metric-locked-cta-${m.metric}`}>
                                <Ionicons name="link" size={9} color={theme.colors.teal} />
                                <AppText size={8} color={theme.colors.teal} style={{ marginLeft: 3 }}>
                                  Connect
                                </AppText>
                              </View>
                            )}
                            {/* Delta indicator (only when available) */}
                            {!isLocked && m.delta_pct !== 0 && (
                              <View style={[styles.delta, { backgroundColor: m.delta_pct >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                                <Ionicons
                                  name={m.delta_pct >= 0 ? 'trending-up' : 'trending-down'}
                                  size={8}
                                  color={m.delta_pct >= 0 ? theme.colors.emerald : theme.colors.danger}
                                />
                                <AppText
                                  size={8}
                                  color={m.delta_pct >= 0 ? theme.colors.emerald : theme.colors.danger}
                                  style={{ marginLeft: 2 }}
                                >
                                  {Math.abs(m.delta_pct).toFixed(1)}%
                                </AppText>
                              </View>
                            )}
                          </GlassCard>
                        </Pressable>
                      </Animated.View>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            );
          })}

          {/* Quick Actions */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            Quick Actions
          </AppText>
          <View style={styles.quickActionsRow}>
            <Pressable onPress={() => router.push('/water-tracking')} style={styles.quickActionBtn}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Ionicons name="water" size={22} color="#3B82F6" />
              </View>
              <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 6 }}>Water</AppText>
            </Pressable>
            <Pressable onPress={() => router.push('/achievements')} style={styles.quickActionBtn}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <Ionicons name="trophy" size={22} color="#F59E0B" />
              </View>
              <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 6 }}>Badges</AppText>
            </Pressable>
            <Pressable onPress={() => router.push('/emergency')} style={styles.quickActionBtn}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="warning" size={22} color="#EF4444" />
              </View>
              <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 6 }}>SOS</AppText>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/settings')} style={styles.quickActionBtn}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                <Ionicons name="settings-outline" size={22} color="#8B5CF6" />
              </View>
              <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 6 }}>Settings</AppText>
            </Pressable>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
      <SyncingOverlay
        visible={syncing}
        label="Syncing your health data"
        subtitle="Bridging metrics from your watches & connected apps…"
      />
    </View>
  );
}

function formatValue(value: number, unit: string): string {
  if (unit === 'steps') return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  if (unit === 'kcal') return Math.round(value).toLocaleString();
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}

function RingLine({ label, value, goal, unit, colorFrom, colorTo }: {
  label: string;
  value: string;
  goal: number;
  unit: string;
  colorFrom: string;
  colorTo: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LinearGradient
        colors={[colorFrom, colorTo]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 6, height: 26, borderRadius: 3 }}
      />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <AppText size={10} color={theme.colors.textDim}>{label}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <AppText weight="heading" size={16}>{value}</AppText>
          <AppText size={9} color={theme.colors.textMute} style={{ marginLeft: 3 }}>/ {formatValue(goal, unit)}</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg, paddingTop: theme.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space.sm, marginBottom: theme.space.md },
  insightBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  aiBadge: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  proTag: { backgroundColor: 'rgba(45,212,191,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  ringsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  
  // Category styles
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space.lg,
    paddingVertical: 8,
  },
  categoryIcon: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  
  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metricCell: {
    width: '31%',
  },
  metricCard: {
    padding: 10,
    minHeight: 100,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sourceBadges: {
    flexDirection: 'row',
    gap: 2,
  },
  sourceBadge: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(243,244,246,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  sparkContainer: {
    marginTop: 4,
  },
  delta: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 999,
  },
  
  // Quick actions
  sectionLabel: { marginTop: theme.space.lg, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: theme.space.sm },
  quickActionBtn: { alignItems: 'center', padding: 8 },
  quickActionIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  connectBanner: {
    marginBottom: theme.space.md,
    padding: theme.space.md,
    overflow: 'hidden',
  },
  connectBannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(45,212,191,0.14)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Locked metric state
  metricLocked: {
    opacity: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  lockBadge: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  connectCta: {
    position: 'absolute', bottom: 6, right: 6,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.14)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
  },
});
