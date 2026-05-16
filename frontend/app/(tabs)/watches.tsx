import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import ProximityScanModal from '@/src/components/ProximityScanModal';
import SyncingOverlay from '@/src/components/SyncingOverlay';
import { api, type Watch } from '@/src/api/client';

const WATCH_META = {
  apple: {
    name: 'Apple Watch',
    accent: ['#F3F4F6', '#9CA3AF'] as const,
    icon: 'logo-apple' as const,
  },
  samsung: {
    name: 'Galaxy Watch',
    accent: ['#3B82F6', '#1E3A8A'] as const,
    icon: 'phone-portrait' as const,
  },
} as const;

export default function Watches() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [proximityWatch, setProximityWatch] = useState<Watch | null>(null);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try { setWatches(await api.watches()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (w: Watch) => {
    // Disconnect immediately. Connect requires a proximity scan first.
    if (w.connected) {
      try {
        const updated = await api.toggleWatch(w.id);
        setWatches((ws) => ws.map((x) => (x.id === w.id ? updated : x)));
      } catch {}
      return;
    }
    setProximityWatch(w);
  };

  const handleProximityProceed = async () => {
    if (!proximityWatch) return;
    const w = proximityWatch;
    setProximityWatch(null);
    setSyncing(true);
    try {
      const updated = await api.toggleWatch(w.id);
      setWatches((ws) => ws.map((x) => (x.id === w.id ? updated : x)));
      // Trigger initial sync after connection
      await api.syncNow();
      await load();
    } catch {}
    finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.root} testID="watches-screen">
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
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Your watches</AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 4 }}>
              Bridge health data + forward notifications across ecosystems.
            </AppText>
          </View>

          <Pressable
            onPress={() => router.push('/connect')}
            testID="watches-open-wizard"
          >
            <GlassCard glow style={{ marginBottom: theme.space.md, padding: theme.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.iconBox, { borderColor: 'rgba(45,212,191,0.4)', backgroundColor: 'rgba(45,212,191,0.12)' }]}>
                  <Ionicons name="git-compare-outline" size={20} color={theme.colors.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText weight="semi" size={14}>Connect Wizard</AppText>
                  <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                    Step-by-step bridge setup. Honest about what's possible.
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
              </View>
            </GlassCard>
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications')}
            testID="watches-open-notifications"
          >
            <GlassCard style={{ marginBottom: theme.space.md, padding: theme.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.iconBox, { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Ionicons name="notifications-outline" size={20} color={theme.colors.samsung} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText weight="semi" size={14}>Notification Bridge</AppText>
                  <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                    Forward iPhone notifications to your Galaxy Watch over BLE.
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
              </View>
            </GlassCard>
          </Pressable>

          {watches.map((w, i) => {
            const meta = WATCH_META[w.platform as 'apple' | 'samsung'] ?? WATCH_META.apple;
            return (
              <Animated.View key={w.id} entering={FadeInDown.delay(80 * i).duration(400)}>
                <GlassCard style={styles.card} testID={`watch-card-${w.platform}`}>
                  <LinearGradient
                    colors={[`${meta.accent[0]}22`, 'transparent']}
                    style={styles.cardGlow}
                    pointerEvents="none"
                  />
                  <View style={styles.cardTop}>
                    <View style={[styles.iconBox, { borderColor: `${meta.accent[0]}55`, backgroundColor: `${meta.accent[0]}18` }]}>
                      <Ionicons name={meta.icon} size={22} color={meta.accent[0]} />
                    </View>
                    <View style={[styles.statusPill, w.connected ? styles.statusOn : styles.statusOff]}>
                      <View style={[styles.statusDot, { backgroundColor: w.connected ? theme.colors.emerald : theme.colors.textMute }]} />
                      <AppText size={10} weight="semi" color={w.connected ? theme.colors.emerald : theme.colors.textDim}>
                        {w.connected ? 'CONNECTED' : 'DISCONNECTED'}
                      </AppText>
                    </View>
                  </View>
                  <AppText weight="heading" size={20} style={{ marginTop: 12 }}>{w.model}</AppText>
                  <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                    {meta.name} · {w.platform === 'apple' ? 'HealthKit bridge' : 'Health Connect bridge'}
                  </AppText>

                  <View style={styles.statsRow}>
                    <Stat icon="battery-half" label="Battery" value={`${w.battery}%`} />
                    <Stat icon="time" label="Last sync" value={timeAgo(w.last_sync_at)} />
                    <Stat
                      icon="swap-horizontal"
                      label="Direction"
                      value="Bi-directional"
                    />
                  </View>

                  <View style={{ height: 14 }} />
                  <PrimaryButton
                    title={w.connected ? 'Disconnect' : 'Connect Watch'}
                    variant={w.connected ? 'secondary' : 'primary'}
                    onPress={() => toggle(w)}
                    testID={`watch-toggle-${w.platform}`}
                  />
                </GlassCard>
              </Animated.View>
            );
          })}

          <GlassCard style={styles.helpCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.teal} />
              <AppText weight="semi" size={14} style={{ marginLeft: 8 }}>How the bridge works</AppText>
            </View>
            <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8, lineHeight: 18 }}>
              On iOS, your iPhone reads from Apple Watch via HealthKit and your encrypted vault writes Galaxy data into Apple Health.
              On Android, Health Connect mirrors Apple Watch metrics into Samsung Health / Google Fit. Native bridge requires a custom dev build.
            </AppText>
          </GlassCard>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <ProximityScanModal
        visible={!!proximityWatch}
        watchId={proximityWatch?.id ?? null}
        watchName={proximityWatch?.model || 'Watch'}
        onClose={() => setProximityWatch(null)}
        onProceed={handleProximityProceed}
      />
      <SyncingOverlay
        visible={syncing}
        label="Connecting & syncing"
        subtitle="Reading metrics from your watch into the HealthBridge vault…"
      />
    </View>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIconRow}>
        <Ionicons name={icon} size={12} color={theme.colors.textDim} />
        <AppText size={10} color={theme.colors.textDim} style={{ marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</AppText>
      </View>
      <AppText weight="semi" size={13} style={{ marginTop: 4 }}>{value}</AppText>
    </View>
  );
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
  card: { marginBottom: theme.space.md, padding: theme.space.lg, overflow: 'hidden' },
  cardGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: {
    width: 52, height: 52, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  statusOn: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.1)' },
  statusOff: { borderColor: theme.colors.border, backgroundColor: theme.colors.glass },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statsRow: {
    flexDirection: 'row', marginTop: theme.space.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.space.md, gap: 8,
  },
  stat: { flex: 1 },
  statIconRow: { flexDirection: 'row', alignItems: 'center' },
  helpCard: { marginTop: theme.space.md },
});
