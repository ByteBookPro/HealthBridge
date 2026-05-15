import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';

type Dir = { from: 'apple' | 'samsung'; to: 'apple' | 'samsung'; label: string; sub: string };
const DIRS: Dir[] = [
  { from: 'apple', to: 'samsung', label: 'Apple Health → Samsung Health', sub: 'I just switched from iPhone to Android' },
  { from: 'samsung', to: 'apple', label: 'Samsung Health → Apple Health', sub: 'I just switched from Android to iPhone' },
];

export default function Migrate() {
  const router = useRouter();
  const [dir, setDir] = useState<Dir | null>(null);
  const [job, setJob] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<any>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const start = async () => {
    if (!dir) return;
    setBusy(true);
    try {
      const j = await api.migrateStart(dir.from, dir.to, 90);
      setJob(j);
      pollRef.current = setInterval(async () => {
        try {
          const u = await api.migrateJob(j.id);
          setJob(u);
          if (u.status !== 'running') {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {}
      }, 1200);
    } catch (e: any) {
      Alert.alert('Migration failed', e?.message ?? 'Error');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root} testID="migrate-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} testID="migrate-back">
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>

          <View style={styles.head}>
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Migration Wizard</AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6, lineHeight: 19 }}>
              Switching phones? Pull your last 90 days of health history from one ecosystem and write it natively into the other.
            </AppText>
          </View>

          {!job && (
            <Animated.View entering={FadeIn.duration(400)}>
              {DIRS.map((d) => {
                const selected = dir?.from === d.from;
                return (
                  <Pressable key={d.from} onPress={() => setDir(d)} testID={`migrate-dir-${d.from}`}>
                    <GlassCard style={[styles.dirCard, selected && styles.dirCardSelected]}>
                      <View style={styles.dirRow}>
                        <View style={[styles.platBadge, { backgroundColor: d.from === 'apple' ? 'rgba(243,244,246,0.15)' : 'rgba(59,130,246,0.18)' }]}>
                          <Ionicons name={d.from === 'apple' ? 'logo-apple' : 'phone-portrait'} size={18} color={d.from === 'apple' ? theme.colors.apple : theme.colors.samsung} />
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={theme.colors.textMute} style={{ marginHorizontal: 10 }} />
                        <View style={[styles.platBadge, { backgroundColor: d.to === 'apple' ? 'rgba(243,244,246,0.15)' : 'rgba(59,130,246,0.18)' }]}>
                          <Ionicons name={d.to === 'apple' ? 'logo-apple' : 'phone-portrait'} size={18} color={d.to === 'apple' ? theme.colors.apple : theme.colors.samsung} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <AppText weight="semi" size={13}>{d.label}</AppText>
                          <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>{d.sub}</AppText>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.teal} />}
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
              <View style={{ height: 14 }} />
              <PrimaryButton
                title="Start migration"
                onPress={start}
                disabled={!dir}
                loading={busy}
                testID="migrate-start-btn"
                icon={<Ionicons name="play" size={16} color="#fff" />}
              />
            </Animated.View>
          )}

          {job && (
            <Animated.View entering={FadeInUp.duration(400)}>
              <GlassCard style={{ marginTop: 4 }} glow testID="migrate-progress-card">
                <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <View style={styles.bigIcon}>
                    <Ionicons
                      name={job.status === 'completed' ? 'checkmark-circle' : 'sync'}
                      size={48}
                      color={job.status === 'completed' ? theme.colors.emerald : theme.colors.teal}
                    />
                  </View>
                  <AppText weight="heading" size={20} style={{ marginTop: 14, letterSpacing: -0.3 }}>
                    {job.status === 'completed' ? 'Migration complete' : 'Migrating…'}
                  </AppText>
                  <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 4 }}>
                    {job.source} → {job.target} · last {job.range_days} days
                  </AppText>
                </View>

                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={theme.gradients.primaryBtn as any}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${job.progress}%` }]}
                  />
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={20}>{job.progress}%</AppText>
                    <AppText size={10} color={theme.colors.textDim}>Progress</AppText>
                  </View>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={20}>{job.samples_migrated.toLocaleString()}</AppText>
                    <AppText size={10} color={theme.colors.textDim}>Samples</AppText>
                  </View>
                  <View style={styles.statCol}>
                    <AppText weight="heading" size={20}>{job.total.toLocaleString()}</AppText>
                    <AppText size={10} color={theme.colors.textDim}>Total</AppText>
                  </View>
                </View>

                {job.status === 'completed' && (
                  <>
                    <View style={styles.successPanel}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.emerald} />
                      <AppText size={12} color={theme.colors.emerald} weight="semi" style={{ marginLeft: 8, flex: 1 }}>
                        {job.message ?? 'Done'}
                      </AppText>
                    </View>
                    <View style={{ height: 14 }} />
                    <PrimaryButton
                      title="Open dashboard"
                      onPress={() => router.replace('/(tabs)')}
                      testID="migrate-finish-btn"
                      icon={<Ionicons name="grid-outline" size={16} color="#fff" />}
                    />
                  </>
                )}
              </GlassCard>
            </Animated.View>
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
  back: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
  },
  head: { marginTop: theme.space.lg, marginBottom: theme.space.lg },
  dirCard: { marginBottom: 10, padding: theme.space.md },
  dirCardSelected: { borderColor: 'rgba(45,212,191,0.5)', backgroundColor: 'rgba(45,212,191,0.05)' },
  dirRow: { flexDirection: 'row', alignItems: 'center' },
  platBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bigIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 14, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  statsRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  statCol: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: theme.colors.glass, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  successPanel: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 14, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
});
