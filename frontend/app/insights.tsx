import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

const SEV_COLOR: Record<string, string> = {
  good: '#10B981', info: '#3B82F6', warning: '#F59E0B', critical: '#EF4444',
};
const SEV_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  good: 'checkmark-circle', info: 'information-circle',
  warning: 'warning', critical: 'alert-circle',
};

export default function Insights() {
  const router = useRouter();
  const { user } = useAuth();
  const isPro = user?.subscription?.plan === 'pro';
  const [insights, setInsights] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const [ins, rep] = await Promise.all([
        api.insights().catch(() => []),
        isPro ? api.weeklyReport().catch(() => null) : Promise.resolve(null),
      ]);
      setInsights(ins); setReport(rep);
    } catch {}
  }, [isPro]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const fresh = await api.generateInsights();
      setInsights(fresh);
    } catch (e: any) {
      Alert.alert('Could not generate', e?.message ?? 'Try again in a moment.');
    } finally { setGenerating(false); }
  };

  if (!isPro) {
    return (
      <View style={styles.root} testID="insights-paywall">
        <AuroraBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} testID="insights-back">
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.head}>
              <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>AI Health Insights</AppText>
              <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6, lineHeight: 19 }}>
                Personalized weekly briefings from a board-certified health coach AI. PRO members only.
              </AppText>
            </View>
            <GlassCard glow style={{ marginTop: theme.space.md }}>
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <View style={styles.bigIcon}>
                  <Ionicons name="sparkles" size={42} color={theme.colors.teal} />
                </View>
                <AppText weight="heading" size={22} style={{ marginTop: 16, letterSpacing: -0.3 }}>
                  Unlock with PRO
                </AppText>
                <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
                  AI weekly insights · Multi-watch bridge · Unlimited export · Goals · Priority support
                </AppText>
                <View style={{ height: 18 }} />
                <View style={{ width: '100%' }}>
                  <PrimaryButton
                    title="Upgrade to PRO — $4.99/mo"
                    onPress={() => router.push('/(tabs)/settings')}
                    testID="insights-upgrade-btn"
                    icon={<Ionicons name="rocket" size={16} color="#fff" />}
                  />
                </View>
              </View>
            </GlassCard>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="insights-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.colors.teal} />}
        >
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} testID="insights-back">
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.head}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>AI Insights</AppText>
              <View style={styles.proPill}>
                <Ionicons name="diamond" size={10} color={theme.colors.teal} />
                <AppText size={10} weight="semi" color={theme.colors.teal} style={{ marginLeft: 4 }}>PRO</AppText>
              </View>
            </View>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6, lineHeight: 19 }}>
              Personalized findings from your last 14 days of bridged metrics.
            </AppText>
          </View>

          <PrimaryButton
            title={generating ? 'Analyzing your week…' : 'Generate fresh insights'}
            onPress={generate}
            loading={generating}
            testID="insights-generate-btn"
            icon={<Ionicons name="sparkles" size={16} color="#fff" />}
          />

          <View style={{ height: theme.space.md }} />

          {insights.length === 0 && !generating && (
            <GlassCard>
              <AppText size={13} color={theme.colors.textDim} style={{ textAlign: 'center', padding: 16 }}>
                No insights yet. Tap the button above to generate your first briefing.
              </AppText>
            </GlassCard>
          )}

          {insights.map((ins, i) => (
            <Animated.View key={ins.id} entering={FadeInUp.delay(i * 80).duration(400)}>
              <GlassCard style={{ marginBottom: 10 }} testID={`insight-${i}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.sevBadge, { backgroundColor: `${SEV_COLOR[ins.severity]}22`, borderColor: `${SEV_COLOR[ins.severity]}55` }]}>
                    <Ionicons name={SEV_ICON[ins.severity] ?? 'information-circle'} size={16} color={SEV_COLOR[ins.severity]} />
                  </View>
                  <AppText weight="heading" size={16} style={{ flex: 1, marginLeft: 10, letterSpacing: -0.3 }}>
                    {ins.title}
                  </AppText>
                </View>
                <AppText size={13} color={theme.colors.text} style={{ marginTop: 10, lineHeight: 19 }}>
                  {ins.summary}
                </AppText>
                {!!ins.action && (
                  <View style={styles.actionRow}>
                    <Ionicons name="play-forward" size={12} color={theme.colors.teal} />
                    <AppText size={12} weight="semi" color={theme.colors.teal} style={{ marginLeft: 6 }}>
                      {ins.action}
                    </AppText>
                  </View>
                )}
              </GlassCard>
            </Animated.View>
          ))}

          {report && (
            <>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Weekly Report
              </AppText>
              <GlassCard>
                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={24}>{report.syncs_total}</AppText>
                    <AppText size={10} color={theme.colors.textDim}>SYNCS</AppText>
                  </View>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={24}>{report.breakdown.length}</AppText>
                    <AppText size={10} color={theme.colors.textDim}>METRICS</AppText>
                  </View>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={24} color={theme.colors.emerald}>↑</AppText>
                    <AppText size={10} color={theme.colors.textDim}>TRENDING</AppText>
                  </View>
                </View>
                <View style={{ height: 10 }} />
                {report.breakdown.slice(0, 6).map((b: any, i: number) => (
                  <View key={b.metric} style={[styles.bRow, i !== 5 && styles.divider]}>
                    <AppText size={13} weight="semi" style={{ flex: 1 }}>{b.label}</AppText>
                    <AppText size={11} color={theme.colors.textDim}>avg {b.avg}</AppText>
                    <View style={{ width: 10 }} />
                    <AppText size={11} weight="semi" color={b.change_pct >= 0 ? theme.colors.emerald : theme.colors.danger}>
                      {b.change_pct >= 0 ? '+' : ''}{b.change_pct}%
                    </AppText>
                  </View>
                ))}
              </GlassCard>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.space.lg },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  head: { marginTop: theme.space.lg, marginBottom: theme.space.lg },
  bigIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)', alignItems: 'center', justifyContent: 'center' },
  proPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)', backgroundColor: 'rgba(45,212,191,0.1)' },
  sevBadge: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginTop: theme.space.lg, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCol: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: theme.colors.glass, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  bRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
});
