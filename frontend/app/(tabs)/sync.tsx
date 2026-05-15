import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api, type ConflictPolicy, type SyncEvent, type SyncPref } from '@/src/api/client';

const LABELS: Record<string, string> = {
  steps: 'Steps', heart_rate: 'Heart Rate', sleep: 'Sleep',
  workouts: 'Workouts', spo2: 'Blood Oxygen', ecg: 'ECG',
  calories: 'Calories', stand: 'Stand',
};
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  steps: 'footsteps-outline', heart_rate: 'heart-outline', sleep: 'moon-outline',
  workouts: 'barbell-outline', spo2: 'water-outline', ecg: 'pulse-outline',
  calories: 'flame-outline', stand: 'body-outline',
};

const POLICIES: { key: ConflictPolicy['policy']; label: string; desc: string }[] = [
  { key: 'latest_wins', label: 'Latest entry wins', desc: 'Newest timestamp is the source of truth.' },
  { key: 'apple_wins', label: 'Apple Health priority', desc: 'Apple Health values override others on conflict.' },
  { key: 'samsung_wins', label: 'Samsung Health priority', desc: 'Samsung Health values override others.' },
  { key: 'manual', label: 'Ask me each time', desc: 'You decide on each conflict.' },
];

export default function SyncScreen() {
  const [prefs, setPrefs] = useState<SyncPref[]>([]);
  const [policy, setPolicy] = useState<ConflictPolicy | null>(null);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, pol, ev] = await Promise.all([api.prefs(), api.policy(), api.events(15)]);
      setPrefs(p); setPolicy(pol); setEvents(ev);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePref = async (pref: SyncPref) => {
    const next: SyncPref = { ...pref, enabled: !pref.enabled };
    setPrefs((ps) => ps.map((x) => (x.metric === pref.metric ? next : x)));
    try { await api.updatePref(pref.metric, next); } catch {}
  };

  const setPolicyKey = async (k: ConflictPolicy['policy']) => {
    if (!policy) return;
    const next = { ...policy, policy: k };
    setPolicy(next);
    try { await api.updatePolicy(next); } catch {}
  };

  return (
    <View style={styles.root} testID="sync-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={theme.colors.teal}
            />
          }
        >
          <View style={styles.head}>
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Sync</AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 4 }}>
              Bidirectional control over what flows where.
            </AppText>
          </View>

          {/* Per-metric toggles */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard testID="sync-prefs-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Bidirectional Sync · Per Metric
              </AppText>
              {prefs.map((p, i) => (
                <View
                  key={p.metric}
                  style={[styles.row, i !== prefs.length - 1 && styles.divider]}
                >
                  <View style={styles.metricBadge}>
                    <Ionicons name={ICONS[p.metric] ?? 'pulse'} size={16} color={theme.colors.teal} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText weight="semi" size={14}>{LABELS[p.metric] ?? p.metric}</AppText>
                    <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                      Apple ⇄ Samsung ⇄ Vault
                    </AppText>
                  </View>
                  <Switch
                    value={p.enabled}
                    onValueChange={() => togglePref(p)}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(45,212,191,0.4)' }}
                    thumbColor={p.enabled ? theme.colors.teal : '#777'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                    testID={`sync-toggle-${p.metric}`}
                  />
                </View>
              ))}
            </GlassCard>
          </Animated.View>

          {/* Conflict policy */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} testID="conflict-policy-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Conflict Resolution
              </AppText>
              {POLICIES.map((p, i) => {
                const selected = policy?.policy === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setPolicyKey(p.key)}
                    style={[styles.policy, i !== POLICIES.length - 1 && styles.divider]}
                    testID={`policy-${p.key}`}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText weight="semi" size={14} color={selected ? theme.colors.teal : theme.colors.text}>
                        {p.label}
                      </AppText>
                      <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                        {p.desc}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </GlassCard>
          </Animated.View>

          {/* Audit log */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} testID="audit-log-card">
              <View style={styles.logHead}>
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  Recent Activity
                </AppText>
                <View style={styles.live}>
                  <View style={[styles.statusDot, { backgroundColor: theme.colors.emerald }]} />
                  <AppText size={10} color={theme.colors.emerald} weight="semi">LIVE</AppText>
                </View>
              </View>
              {events.length === 0 && (
                <AppText size={12} color={theme.colors.textDim} style={{ paddingVertical: 12 }}>
                  No sync events yet. Pull to refresh.
                </AppText>
              )}
              {events.map((e, i) => (
                <View key={e.id} style={[styles.eventRow, i !== events.length - 1 && styles.divider]}>
                  <View style={styles.eventIcon}>
                    <Ionicons name={ICONS[e.metric] ?? 'sync'} size={14} color={theme.colors.teal} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <AppText weight="semi" size={13}>{LABELS[e.metric] ?? e.metric}</AppText>
                      <Ionicons name="arrow-forward" size={11} color={theme.colors.textMute} style={{ marginHorizontal: 6 }} />
                      <AppText size={11} color={theme.colors.textDim}>{e.source} → {e.destination}</AppText>
                    </View>
                    <AppText size={11} color={theme.colors.textMute} style={{ marginTop: 2 }}>
                      {fmtVal(e.value, e.unit)} · {timeAgo(e.created_at)}
                    </AppText>
                  </View>
                  {e.status === 'conflict_resolved' ? (
                    <View style={[styles.tag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                      <AppText size={9} weight="semi" color={theme.colors.warning}>RESOLVED</AppText>
                    </View>
                  ) : (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.emerald} />
                  )}
                </View>
              ))}
            </GlassCard>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function fmtVal(v: number, u: string) {
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${u}`;
}
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.space.lg },
  head: { marginTop: theme.space.sm, marginBottom: theme.space.lg },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  metricBadge: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  policy: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: theme.colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: theme.colors.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.teal },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  eventIcon: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
