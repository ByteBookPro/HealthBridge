import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, Pressable, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TimeRange = 'day' | 'week' | 'month' | 'year';

const METRIC_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  gradient: [string, string];
  title: string;
  unit: string;
  description: string;
  scientificMetrics: { label: string; key: string; unit: string; description: string }[];
}> = {
  steps: {
    icon: 'footsteps-outline',
    color: '#2DD4BF',
    gradient: ['#2DD4BF', '#10B981'],
    title: 'Steps',
    unit: 'steps',
    description: 'Daily walking and running activity',
    scientificMetrics: [
      { label: 'Distance', key: 'distance_km', unit: 'km', description: 'Estimated distance walked' },
      { label: 'Calories Burned', key: 'calories_burned', unit: 'kcal', description: 'Energy expenditure from steps' },
      { label: 'Active Minutes', key: 'active_minutes', unit: 'min', description: 'Time spent in motion' },
      { label: 'Floors Climbed', key: 'floors_climbed', unit: 'floors', description: 'Elevation gain equivalent' },
      { label: 'Cadence', key: 'avg_cadence', unit: 'spm', description: 'Steps per minute average' },
      { label: 'Step Asymmetry', key: 'step_asymmetry', unit: '%', description: 'Balance between left/right' },
    ],
  },
  heart_rate: {
    icon: 'heart-outline',
    color: '#EF4444',
    gradient: ['#EF4444', '#DC2626'],
    title: 'Heart Rate',
    unit: 'bpm',
    description: 'Cardiovascular health monitoring',
    scientificMetrics: [
      { label: 'Resting HR', key: 'resting_hr', unit: 'bpm', description: 'Your baseline heart rate' },
      { label: 'Max HR', key: 'max_hr', unit: 'bpm', description: 'Peak heart rate recorded' },
      { label: 'HRV', key: 'hrv', unit: 'ms', description: 'Heart Rate Variability (RMSSD)' },
      { label: 'Recovery Rate', key: 'recovery_rate', unit: 'bpm/min', description: 'HR drop after exercise' },
      { label: 'Fat Burn Zone', key: 'fat_burn_minutes', unit: 'min', description: '50-69% of max HR' },
      { label: 'Cardio Zone', key: 'cardio_minutes', unit: 'min', description: '70-84% of max HR' },
      { label: 'Peak Zone', key: 'peak_minutes', unit: 'min', description: '85%+ of max HR' },
    ],
  },
  sleep: {
    icon: 'moon-outline',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#7C3AED'],
    title: 'Sleep',
    unit: 'hours',
    description: 'Sleep quality and patterns',
    scientificMetrics: [
      { label: 'Deep Sleep', key: 'deep_sleep', unit: 'h', description: 'Most restorative sleep stage' },
      { label: 'Light Sleep', key: 'light_sleep', unit: 'h', description: 'Transitional sleep phase' },
      { label: 'REM Sleep', key: 'rem_sleep', unit: 'h', description: 'Dream state, memory consolidation' },
      { label: 'Awake Time', key: 'awake_time', unit: 'min', description: 'Interruptions during night' },
      { label: 'Sleep Score', key: 'sleep_score', unit: '/100', description: 'Overall sleep quality' },
      { label: 'Sleep Efficiency', key: 'sleep_efficiency', unit: '%', description: 'Time asleep vs in bed' },
      { label: 'Sleep Debt', key: 'sleep_debt', unit: 'h', description: 'Cumulative deficit this week' },
      { label: 'Consistency', key: 'consistency_score', unit: '/100', description: 'Schedule regularity' },
    ],
  },
  workouts: {
    icon: 'barbell-outline',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
    title: 'Workouts',
    unit: 'min',
    description: 'Exercise and training metrics',
    scientificMetrics: [
      { label: 'VO2 Max', key: 'vo2_max', unit: 'mL/kg/min', description: 'Aerobic fitness indicator' },
      { label: 'Training Load', key: 'training_load', unit: 'TRIMP', description: 'Weekly workout intensity' },
      { label: 'Recovery Time', key: 'recovery_hours', unit: 'h', description: 'Recommended rest period' },
      { label: 'Calories Burned', key: 'workout_calories', unit: 'kcal', description: 'Energy spent exercising' },
      { label: 'Avg Heart Rate', key: 'avg_workout_hr', unit: 'bpm', description: 'Mean HR during exercise' },
      { label: 'Workout Count', key: 'workout_count', unit: 'sessions', description: 'This week\'s sessions' },
    ],
  },
  spo2: {
    icon: 'water-outline',
    color: '#3B82F6',
    gradient: ['#3B82F6', '#2563EB'],
    title: 'Blood Oxygen',
    unit: '%',
    description: 'Oxygen saturation levels',
    scientificMetrics: [
      { label: 'Avg SpO2', key: 'avg_spo2', unit: '%', description: 'Average oxygen saturation' },
      { label: 'Min SpO2', key: 'min_spo2', unit: '%', description: 'Lowest recorded level' },
      { label: 'Night Avg', key: 'night_avg_spo2', unit: '%', description: 'Sleep-time average' },
      { label: 'Low Events', key: 'low_spo2_events', unit: 'events', description: 'Drops below 90%' },
      { label: 'Altitude Adj.', key: 'altitude_adjusted', unit: '%', description: 'Sea-level equivalent' },
      { label: 'Respiratory Rate', key: 'respiratory_rate', unit: 'br/min', description: 'Breaths per minute' },
    ],
  },
  ecg: {
    icon: 'pulse-outline',
    color: '#EC4899',
    gradient: ['#EC4899', '#DB2777'],
    title: 'ECG',
    unit: 'ms',
    description: 'Heart rhythm analysis',
    scientificMetrics: [
      { label: 'PR Interval', key: 'pr_interval', unit: 'ms', description: 'Atrial depolarization time' },
      { label: 'QRS Duration', key: 'qrs_duration', unit: 'ms', description: 'Ventricular depolarization' },
      { label: 'QT Interval', key: 'qt_interval', unit: 'ms', description: 'Total ventricular activity' },
      { label: 'QTc', key: 'qtc', unit: 'ms', description: 'Corrected QT interval' },
      { label: 'Rhythm', key: 'rhythm_classification', unit: '', description: 'Sinus/AFib/Other' },
      { label: 'Readings', key: 'ecg_readings_count', unit: 'total', description: 'ECGs recorded this month' },
    ],
  },
  calories: {
    icon: 'flame-outline',
    color: '#F97316',
    gradient: ['#F97316', '#EA580C'],
    title: 'Calories',
    unit: 'kcal',
    description: 'Energy expenditure tracking',
    scientificMetrics: [
      { label: 'BMR', key: 'bmr', unit: 'kcal', description: 'Basal Metabolic Rate' },
      { label: 'TDEE', key: 'tdee', unit: 'kcal', description: 'Total Daily Energy Expenditure' },
      { label: 'Active Calories', key: 'active_calories', unit: 'kcal', description: 'From movement & exercise' },
      { label: 'Resting Calories', key: 'resting_calories', unit: 'kcal', description: 'Baseline metabolism' },
      { label: 'Net Calories', key: 'net_calories', unit: 'kcal', description: 'Intake minus burned' },
      { label: 'Weekly Average', key: 'weekly_avg_calories', unit: 'kcal', description: 'Daily burn average' },
    ],
  },
  stand: {
    icon: 'body-outline',
    color: '#10B981',
    gradient: ['#10B981', '#059669'],
    title: 'Stand Hours',
    unit: 'hours',
    description: 'Movement and posture breaks',
    scientificMetrics: [
      { label: 'Stand Hours', key: 'stand_hours', unit: 'hr', description: 'Hours with 1+ min standing' },
      { label: 'Stand Minutes', key: 'total_stand_minutes', unit: 'min', description: 'Total time standing' },
      { label: 'Sedentary Time', key: 'sedentary_hours', unit: 'h', description: 'Hours without movement' },
      { label: 'Movement Breaks', key: 'movement_breaks', unit: 'breaks', description: 'Sitting interruptions' },
      { label: 'Longest Sit', key: 'longest_sedentary', unit: 'min', description: 'Max unbroken sitting' },
      { label: 'Goal Streak', key: 'stand_streak', unit: 'days', description: 'Consecutive goal days' },
    ],
  },
};

interface MetricDetail {
  metric: string;
  current: number;
  goal: number;
  unit: string;
  trend: number[];
  apple_value: number | null;
  samsung_value: number | null;
  delta_pct: number;
  history: {
    date: string;
    value: number;
    apple_value?: number;
    samsung_value?: number;
  }[];
  scientific: Record<string, number | string>;
  statistics: {
    avg: number;
    min: number;
    max: number;
    total: number;
  };
  hourly?: { hour: number; value: number }[];
}

export default function MetricDetailScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<MetricDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  const config = METRIC_CONFIG[type || 'steps'] || METRIC_CONFIG.steps;

  const load = useCallback(async () => {
    try {
      const data = await api.metricDetail(type || 'steps', timeRange);
      setDetail(data);
    } catch (e) {
      console.error('Failed to load metric detail:', e);
    } finally {
      setLoading(false);
    }
  }, [type, timeRange]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const formatValue = (v: number, unit: string) => {
    if (unit === 'steps' || unit === 'kcal') return Math.round(v).toLocaleString();
    if (unit === '%') return v.toFixed(1);
    if (unit === 'h' || unit === 'hours') return v.toFixed(1);
    return v.toFixed(1);
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerTitle}>
            <View style={[styles.iconWrap, { backgroundColor: `${config.color}22`, borderColor: `${config.color}55` }]}>
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
            <AppText weight="heading" size={20} style={{ marginLeft: 12 }}>{config.title}</AppText>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.teal} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Value Card */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard glow style={styles.mainCard}>
              <AppText size={12} color={theme.colors.textDim}>{config.description}</AppText>
              <View style={styles.currentRow}>
                <AppText weight="heading" size={56} style={{ letterSpacing: -2, color: config.color }}>
                  {detail ? formatValue(detail.current, detail.unit) : '—'}
                </AppText>
                <View style={styles.unitCol}>
                  <AppText size={16} color={theme.colors.textMute}>{config.unit}</AppText>
                  {detail && (
                    <View style={[styles.deltaBadge, { backgroundColor: detail.delta_pct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
                      <Ionicons 
                        name={detail.delta_pct >= 0 ? 'trending-up' : 'trending-down'} 
                        size={12} 
                        color={detail.delta_pct >= 0 ? theme.colors.emerald : theme.colors.danger} 
                      />
                      <AppText size={11} weight="semi" color={detail.delta_pct >= 0 ? theme.colors.emerald : theme.colors.danger} style={{ marginLeft: 4 }}>
                        {Math.abs(detail.delta_pct).toFixed(1)}%
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Goal Progress */}
              {detail && (
                <View style={styles.goalSection}>
                  <View style={styles.goalRow}>
                    <AppText size={11} color={theme.colors.textDim}>Goal Progress</AppText>
                    <AppText size={11} color={theme.colors.textMute}>
                      {formatValue(detail.current, detail.unit)} / {formatValue(detail.goal, detail.unit)}
                    </AppText>
                  </View>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={config.gradient as any}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.min(100, (detail.current / detail.goal) * 100)}%` }]}
                    />
                  </View>
                </View>
              )}
              
              {/* Source badges */}
              {detail && (
                <View style={styles.sourceRow}>
                  {detail.apple_value != null && (
                    <View style={styles.sourceBadge}>
                      <Ionicons name="logo-apple" size={12} color={theme.colors.apple} />
                      <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                        {formatValue(detail.apple_value, detail.unit)}
                      </AppText>
                    </View>
                  )}
                  {detail.samsung_value != null && (
                    <View style={styles.sourceBadge}>
                      <Ionicons name="phone-portrait-outline" size={12} color={theme.colors.samsung} />
                      <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                        {formatValue(detail.samsung_value, detail.unit)}
                      </AppText>
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          </Animated.View>

          {/* Time Range Selector */}
          <View style={styles.timeSelector}>
            {(['day', 'week', 'month', 'year'] as TimeRange[]).map((r) => (
              <Pressable
                key={r}
                style={[styles.timeBtn, timeRange === r && styles.timeBtnActive]}
                onPress={() => setTimeRange(r)}
              >
                <AppText 
                  size={12} 
                  weight={timeRange === r ? 'semi' : 'med'} 
                  color={timeRange === r ? config.color : theme.colors.textMute}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* Chart */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard style={styles.chartCard}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
                {timeRange === 'day' ? 'Hourly' : timeRange === 'week' ? '7-Day' : timeRange === 'month' ? '30-Day' : 'Yearly'} Trend
              </AppText>
              {detail && <MetricChart data={detail.history || []} color={config.color} gradient={config.gradient} unit={detail.unit} timeRange={timeRange} />}
            </GlassCard>
          </Animated.View>

          {/* Statistics */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
              Statistics
            </AppText>
            <View style={styles.statsGrid}>
              {detail && (
                <>
                  <StatBox label="Average" value={formatValue(detail.statistics.avg, detail.unit)} unit={config.unit} color={config.color} />
                  <StatBox label="Minimum" value={formatValue(detail.statistics.min, detail.unit)} unit={config.unit} color="#3B82F6" />
                  <StatBox label="Maximum" value={formatValue(detail.statistics.max, detail.unit)} unit={config.unit} color="#F59E0B" />
                  <StatBox label="Total" value={formatValue(detail.statistics.total, detail.unit)} unit={config.unit} color="#8B5CF6" />
                </>
              )}
            </View>
          </Animated.View>

          {/* Scientific Metrics */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
              Health Insights
            </AppText>
            <GlassCard style={styles.scientificCard}>
              {config.scientificMetrics.map((sm, idx) => (
                <View key={sm.key} style={[styles.scientificRow, idx > 0 && styles.scientificRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <AppText size={13} weight="med">{sm.label}</AppText>
                    <AppText size={10} color={theme.colors.textMute}>{sm.description}</AppText>
                  </View>
                  <View style={styles.scientificValue}>
                    <AppText size={18} weight="semi" color={config.color}>
                      {detail?.scientific?.[sm.key] ?? '—'}
                    </AppText>
                    <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 4 }}>{sm.unit}</AppText>
                  </View>
                </View>
              ))}
            </GlassCard>
          </Animated.View>

          {/* Hourly Breakdown (for day view) */}
          {timeRange === 'day' && detail?.hourly && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
                Hourly Breakdown
              </AppText>
              <GlassCard style={styles.hourlyCard}>
                <HourlyChart data={detail.hourly} color={config.color} />
              </GlassCard>
            </Animated.View>
          )}

          {/* Health Zones (for heart rate) */}
          {type === 'heart_rate' && detail && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
                Heart Rate Zones
              </AppText>
              <GlassCard style={styles.zonesCard}>
                <HeartRateZones scientific={detail.scientific} />
              </GlassCard>
            </Animated.View>
          )}

          {/* Sleep Stages (for sleep) */}
          {type === 'sleep' && detail && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
                Sleep Stages
              </AppText>
              <GlassCard style={styles.stagesCard}>
                <SleepStages scientific={detail.scientific} />
              </GlassCard>
            </Animated.View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MetricChart({ data, color, gradient, unit, timeRange }: { 
  data: { date: string; value: number }[]; 
  color: string; 
  gradient: [string, string];
  unit: string;
  timeRange: TimeRange;
}) {
  const width = SCREEN_WIDTH - 64;
  const height = 180;
  const padding = { top: 20, right: 10, bottom: 30, left: 45 };
  
  if (!data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <AppText color={theme.colors.textMute}>No data available</AppText>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1;
  const range = maxVal - minVal || 1;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
  }));

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx1 = prev.x + (p.x - prev.x) / 3;
    const cpx2 = prev.x + 2 * (p.x - prev.x) / 3;
    return `${acc} C ${cpx1} ${prev.y} ${cpx2} ${p.y} ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  const formatLabel = (date: string, index: number) => {
    if (timeRange === 'day') return `${index}h`;
    const d = new Date(date);
    if (timeRange === 'week') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    if (timeRange === 'month') return d.getDate().toString();
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  };

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gradient[0]} stopOpacity="0.3" />
          <Stop offset="1" stopColor={gradient[1]} stopOpacity="0.02" />
        </SvgLinearGradient>
        <SvgLinearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={gradient[0]} />
          <Stop offset="1" stopColor={gradient[1]} />
        </SvgLinearGradient>
      </Defs>
      
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <Line
          key={i}
          x1={padding.left}
          y1={padding.top + pct * chartHeight}
          x2={width - padding.right}
          y2={padding.top + pct * chartHeight}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="4,4"
        />
      ))}
      
      {/* Y-axis labels */}
      {[0, 0.5, 1].map((pct, i) => (
        <SvgText
          key={i}
          x={padding.left - 8}
          y={padding.top + pct * chartHeight + 4}
          fill={theme.colors.textMute}
          fontSize={9}
          textAnchor="end"
        >
          {Math.round(maxVal - pct * range)}
        </SvgText>
      ))}
      
      {/* Area fill */}
      <Path d={areaD} fill="url(#areaGradient)" />
      
      {/* Line */}
      <Path d={pathD} stroke="url(#lineGradient)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      
      {/* Data points */}
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke={theme.colors.bg} strokeWidth={1.5} />
      ))}
      
      {/* X-axis labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0 || i === data.length - 1).map((d, i, arr) => {
        const origIndex = data.indexOf(d);
        const x = padding.left + (origIndex / (data.length - 1 || 1)) * chartWidth;
        return (
          <SvgText
            key={i}
            x={x}
            y={height - 8}
            fill={theme.colors.textMute}
            fontSize={9}
            textAnchor="middle"
          >
            {formatLabel(d.date, origIndex)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function HourlyChart({ data, color }: { data: { hour: number; value: number }[]; color: string }) {
  const width = SCREEN_WIDTH - 64;
  const height = 100;
  const barWidth = (width - 40) / 24;
  
  const maxVal = Math.max(...data.map(d => d.value), 1);
  
  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barHeight = (d.value / maxVal) * (height - 30);
        return (
          <React.Fragment key={i}>
            <Rect
              x={20 + i * barWidth + 2}
              y={height - 20 - barHeight}
              width={barWidth - 4}
              height={barHeight}
              fill={color}
              opacity={0.7}
              rx={2}
            />
            {i % 6 === 0 && (
              <SvgText
                x={20 + i * barWidth + barWidth / 2}
                y={height - 5}
                fill={theme.colors.textMute}
                fontSize={8}
                textAnchor="middle"
              >
                {d.hour}:00
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <GlassCard style={styles.statBox}>
      <AppText size={10} color={theme.colors.textDim}>{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <AppText weight="semi" size={20} color={color}>{value}</AppText>
        <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 4 }}>{unit}</AppText>
      </View>
    </GlassCard>
  );
}

function HeartRateZones({ scientific }: { scientific: Record<string, number | string> }) {
  const zones = [
    { name: 'Rest', range: '< 50%', minutes: Number(scientific.rest_minutes || 0), color: '#94A3B8' },
    { name: 'Fat Burn', range: '50-69%', minutes: Number(scientific.fat_burn_minutes || 0), color: '#10B981' },
    { name: 'Cardio', range: '70-84%', minutes: Number(scientific.cardio_minutes || 0), color: '#F59E0B' },
    { name: 'Peak', range: '85%+', minutes: Number(scientific.peak_minutes || 0), color: '#EF4444' },
  ];
  const total = zones.reduce((s, z) => s + z.minutes, 0) || 1;

  return (
    <View>
      {zones.map((z, i) => (
        <View key={i} style={[styles.zoneRow, i > 0 && { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
              <AppText size={13} weight="med">{z.name}</AppText>
              <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 8 }}>{z.range}</AppText>
            </View>
            <View style={styles.zoneBar}>
              <View style={[styles.zoneFill, { width: `${(z.minutes / total) * 100}%`, backgroundColor: z.color }]} />
            </View>
          </View>
          <AppText size={14} weight="semi" color={z.color} style={{ marginLeft: 12 }}>{z.minutes} min</AppText>
        </View>
      ))}
    </View>
  );
}

function SleepStages({ scientific }: { scientific: Record<string, number | string> }) {
  const stages = [
    { name: 'Deep', hours: Number(scientific.deep_sleep || 0), color: '#8B5CF6', desc: 'Restorative' },
    { name: 'Light', hours: Number(scientific.light_sleep || 0), color: '#A78BFA', desc: 'Transitional' },
    { name: 'REM', hours: Number(scientific.rem_sleep || 0), color: '#C4B5FD', desc: 'Dreams' },
    { name: 'Awake', hours: Number(scientific.awake_time || 0) / 60, color: '#E2E8F0', desc: 'Interruptions' },
  ];
  const total = stages.reduce((s, z) => s + z.hours, 0) || 1;

  return (
    <View>
      <View style={styles.sleepBar}>
        {stages.map((s, i) => (
          <View key={i} style={[styles.sleepSegment, { flex: s.hours / total, backgroundColor: s.color }]} />
        ))}
      </View>
      <View style={styles.sleepLegend}>
        {stages.map((s, i) => (
          <View key={i} style={styles.sleepLegendItem}>
            <View style={[styles.sleepDot, { backgroundColor: s.color }]} />
            <View>
              <AppText size={11} weight="med">{s.name}</AppText>
              <AppText size={10} color={theme.colors.textMute}>{s.hours.toFixed(1)}h</AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg },
  mainCard: { padding: theme.space.lg },
  currentRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  unitCol: { marginLeft: 8, marginBottom: 10 },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  goalSection: { marginTop: 16 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sourceRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  timeSelector: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.space.md, gap: 8 },
  timeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  timeBtnActive: { backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)' },
  chartCard: { marginTop: theme.space.md, padding: theme.space.md },
  sectionLabel: { marginTop: theme.space.lg, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  statBox: { width: '48%', padding: theme.space.md },
  scientificCard: { padding: theme.space.md },
  scientificRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  scientificRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  scientificValue: { flexDirection: 'row', alignItems: 'baseline' },
  hourlyCard: { padding: theme.space.md },
  zonesCard: { padding: theme.space.md },
  zoneRow: {},
  zoneDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  zoneBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: 3 },
  stagesCard: { padding: theme.space.md },
  sleepBar: { height: 24, borderRadius: 12, overflow: 'hidden', flexDirection: 'row' },
  sleepSegment: { height: '100%' },
  sleepLegend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 16 },
  sleepLegendItem: { flexDirection: 'row', alignItems: 'center', width: '45%' },
  sleepDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
});
