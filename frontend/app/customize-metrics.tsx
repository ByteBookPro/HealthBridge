import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api, type MetricSummary } from '@/src/api/client';

const STORAGE_KEY = '@healthbridge_hidden_metrics';

// Category metadata
const CATEGORIES: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  activity: { label: 'Activity', icon: 'walk-outline', color: '#2DD4BF' },
  exercise: { label: 'Exercise', icon: 'barbell-outline', color: '#F59E0B' },
  nutrition: { label: 'Nutrition', icon: 'nutrition-outline', color: '#10B981' },
  body: { label: 'Body', icon: 'body-outline', color: '#8B5CF6' },
  vitals: { label: 'Vitals', icon: 'heart-outline', color: '#EF4444' },
};

// Metric icons
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

export default function CustomizeMetricsScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, stored] = await Promise.all([
        api.metricsAll(),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      setMetrics(data);
      if (stored) {
        setHiddenMetrics(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.warn('Failed to load metrics:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleMetric = async (metricId: string) => {
    setSaving(true);
    const newHidden = new Set(hiddenMetrics);
    if (newHidden.has(metricId)) {
      newHidden.delete(metricId);
    } else {
      newHidden.add(metricId);
    }
    setHiddenMetrics(newHidden);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...newHidden]));
    } catch (e) {
      console.warn('Failed to save preference:', e);
    }
    setSaving(false);
  };

  const toggleCategory = async (category: string) => {
    setSaving(true);
    const categoryMetrics = metrics.filter(m => m.category === category).map(m => m.metric);
    const allHidden = categoryMetrics.every(m => hiddenMetrics.has(m));
    
    const newHidden = new Set(hiddenMetrics);
    if (allHidden) {
      // Show all
      categoryMetrics.forEach(m => newHidden.delete(m));
    } else {
      // Hide all
      categoryMetrics.forEach(m => newHidden.add(m));
    }
    setHiddenMetrics(newHidden);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...newHidden]));
    } catch (e) {
      console.warn('Failed to save preference:', e);
    }
    setSaving(false);
  };

  const showAll = async () => {
    setSaving(true);
    setHiddenMetrics(new Set());
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setSaving(false);
  };

  const hideAll = async () => {
    setSaving(true);
    const allMetrics = new Set(metrics.map(m => m.metric));
    setHiddenMetrics(allMetrics);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...allMetrics]));
    } catch (e) {}
    setSaving(false);
  };

  // Group metrics by category
  const metricsByCategory = metrics.reduce((acc, m) => {
    const cat = m.category || 'activity';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {} as Record<string, MetricSummary[]>);

  const visibleCount = metrics.length - hiddenMetrics.size;
  const categoryOrder = ['activity', 'vitals', 'exercise', 'body', 'nutrition'];

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText weight="heading" size={22}>Customize Dashboard</AppText>
            <AppText size={12} color={theme.colors.textDim}>
              {visibleCount} of {metrics.length} metrics visible
            </AppText>
          </View>
          {saving && <ActivityIndicator size="small" color={theme.colors.teal} />}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Quick Actions */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.quickActions}>
              <Pressable onPress={showAll} style={styles.quickActionBtn}>
                <Ionicons name="eye-outline" size={16} color={theme.colors.teal} />
                <AppText size={11} weight="semi" color={theme.colors.teal} style={{ marginLeft: 6 }}>
                  Show All
                </AppText>
              </Pressable>
              <Pressable onPress={hideAll} style={styles.quickActionBtn}>
                <Ionicons name="eye-off-outline" size={16} color={theme.colors.textDim} />
                <AppText size={11} weight="semi" color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                  Hide All
                </AppText>
              </Pressable>
            </View>
          </Animated.View>

          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle" size={18} color={theme.colors.teal} />
                <AppText size={12} color={theme.colors.textDim} style={{ flex: 1, marginLeft: 10 }}>
                  Toggle metrics on/off to customize your dashboard. Hidden metrics can still be viewed in the metric detail page.
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Categories */}
          {categoryOrder.map((catId, catIdx) => {
            const catMetrics = metricsByCategory[catId] || [];
            if (catMetrics.length === 0) return null;
            
            const catInfo = CATEGORIES[catId];
            const visibleInCategory = catMetrics.filter(m => !hiddenMetrics.has(m.metric)).length;
            const allHidden = visibleInCategory === 0;

            return (
              <Animated.View key={catId} entering={FadeInDown.delay(100 + catIdx * 50).duration(400)}>
                <GlassCard style={styles.categoryCard}>
                  {/* Category Header */}
                  <Pressable onPress={() => toggleCategory(catId)} style={styles.categoryHeader}>
                    <View style={[styles.categoryIcon, { backgroundColor: `${catInfo.color}18`, borderColor: `${catInfo.color}40` }]}>
                      <Ionicons name={catInfo.icon} size={18} color={catInfo.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText weight="semi" size={15}>{catInfo.label}</AppText>
                      <AppText size={11} color={theme.colors.textDim}>
                        {visibleInCategory} of {catMetrics.length} visible
                      </AppText>
                    </View>
                    <Switch
                      value={!allHidden}
                      onValueChange={() => toggleCategory(catId)}
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${catInfo.color}40` }}
                      thumbColor={!allHidden ? catInfo.color : '#777'}
                      ios_backgroundColor="rgba(255,255,255,0.1)"
                    />
                  </Pressable>

                  {/* Metrics List */}
                  <View style={styles.metricsContainer}>
                    {catMetrics.map((m, idx) => {
                      const isHidden = hiddenMetrics.has(m.metric);
                      return (
                        <Pressable
                          key={m.metric}
                          onPress={() => toggleMetric(m.metric)}
                          style={[
                            styles.metricRow,
                            idx < catMetrics.length - 1 && styles.metricDivider,
                            isHidden && styles.metricHidden,
                          ]}
                        >
                          <View style={[styles.metricIcon, { backgroundColor: `${catInfo.color}12` }]}>
                            <Ionicons
                              name={METRIC_ICONS[m.metric] || 'analytics-outline'}
                              size={14}
                              color={isHidden ? theme.colors.textMute : catInfo.color}
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <AppText
                              weight="med"
                              size={13}
                              color={isHidden ? theme.colors.textMute : theme.colors.text}
                            >
                              {m.label}
                            </AppText>
                            <AppText size={10} color={theme.colors.textDim}>
                              {m.current} {m.unit}
                            </AppText>
                          </View>
                          <View style={[
                            styles.toggleIndicator,
                            isHidden ? styles.toggleOff : styles.toggleOn,
                          ]}>
                            <Ionicons
                              name={isHidden ? 'eye-off' : 'eye'}
                              size={12}
                              color={isHidden ? theme.colors.textMute : theme.colors.emerald}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </GlassCard>
              </Animated.View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: theme.space.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.space.md,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoCard: {
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryCard: {
    marginBottom: theme.space.md,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space.md,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    paddingVertical: 10,
  },
  metricDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metricHidden: {
    opacity: 0.6,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIndicator: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  toggleOff: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
