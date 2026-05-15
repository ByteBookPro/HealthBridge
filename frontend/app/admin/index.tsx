import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api, type AdminStats, type User } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

type Tab = 'overview' | 'users' | 'broadcast' | 'audit';

export default function AdminPortal() {
  const { logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [audit, setAudit] = useState<{ sync_events: any[]; notifications: any[] }>({ sync_events: [], notifications: [] });
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [s, u, a] = await Promise.all([api.adminStats(), api.adminUsers(), api.adminAudit()]);
      setStats(s); setUsers(u); setAudit(a);
    } catch (e: any) {
      console.warn(e);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const search = async () => {
    setUsers(await api.adminUsers(q || undefined));
  };

  const setPlan = async (uid: string, plan: 'free' | 'pro') => {
    await api.adminSetPlan(uid, plan);
    await loadAll();
  };

  const cancelSub = async (uid: string) => {
    await api.adminCancelSub(uid, true);
    await loadAll();
  };

  const broadcast = async () => {
    if (!broadcastTitle || !broadcastBody) return;
    setBusy(true);
    try {
      const r = await api.adminBroadcast(broadcastTitle, broadcastBody);
      Alert.alert('Broadcast sent', `Recipients: ${r.recipients} · Push sent: ${r.sent}`);
      setBroadcastTitle(''); setBroadcastBody('');
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Error');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.root} testID="admin-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient
              colors={theme.gradients.bridge as any}
              style={{ width: 28, height: 28, borderRadius: 14 }}
            />
            <View style={{ marginLeft: 10 }}>
              <AppText weight="heading" size={18} style={{ letterSpacing: -0.3 }}>HealthBridge Admin</AppText>
              <AppText size={10} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                Operations console
              </AppText>
            </View>
          </View>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.pill}
            testID="admin-exit-btn"
          >
            <Ionicons name="exit-outline" size={14} color={theme.colors.text} />
            <AppText size={11} weight="semi" style={{ marginLeft: 6 }}>Back to app</AppText>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {([
            { k: 'overview', label: 'Overview', icon: 'stats-chart' },
            { k: 'users', label: 'Users', icon: 'people' },
            { k: 'broadcast', label: 'Broadcast', icon: 'megaphone' },
            { k: 'audit', label: 'Audit', icon: 'shield-checkmark' },
          ] as { k: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[]).map((t) => (
            <Pressable
              key={t.k}
              onPress={() => setTab(t.k)}
              style={[styles.tabBtn, tab === t.k && styles.tabBtnActive]}
              testID={`admin-tab-${t.k}`}
            >
              <Ionicons name={t.icon} size={14} color={tab === t.k ? theme.colors.teal : theme.colors.textDim} />
              <AppText size={12} weight="semi" color={tab === t.k ? theme.colors.teal : theme.colors.textDim} style={{ marginLeft: 6 }}>
                {t.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'overview' && (
            <>
              <View style={styles.statsGrid}>
                <Stat label="Total users" value={stats?.total_users ?? '—'} icon="people-outline" tone="#2DD4BF" testID="stat-total-users" />
                <Stat label="PRO subs" value={stats?.pro_users ?? '—'} icon="diamond-outline" tone="#F59E0B" testID="stat-pro" />
                <Stat label="MRR" value={stats ? `$${stats.mrr_usd.toFixed(2)}` : '—'} icon="trending-up-outline" tone="#10B981" testID="stat-mrr" />
                <Stat label="Syncs (24h)" value={stats?.syncs_24h ?? '—'} icon="sync-outline" tone="#3B82F6" testID="stat-syncs" />
                <Stat label="Active subs" value={stats?.active_subscriptions ?? '—'} icon="card-outline" tone="#8B5CF6" testID="stat-active" />
                <Stat label="Pushes sent" value={stats?.notifications_sent ?? '—'} icon="notifications-outline" tone="#EC4899" testID="stat-pushes" />
              </View>
              <GlassCard style={{ marginTop: theme.space.md }}>
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  Quick actions
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <PrimaryButton title="Refresh stats" variant="secondary" onPress={loadAll}
                      icon={<Ionicons name="refresh" size={14} color="#fff" />} />
                  </View>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <PrimaryButton title="Sign out" variant="danger" onPress={async () => { await logout(); router.replace('/onboarding'); }}
                      icon={<Ionicons name="log-out-outline" size={14} color="#fff" />} />
                  </View>
                </View>
              </GlassCard>
            </>
          )}

          {tab === 'users' && (
            <GlassCard testID="admin-users-card">
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={theme.colors.textDim} />
                <TextInput
                  style={styles.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search by email..."
                  placeholderTextColor={theme.colors.textMute}
                  onSubmitEditing={search}
                  testID="admin-user-search"
                />
                <Pressable onPress={search} hitSlop={6} testID="admin-user-search-btn">
                  <AppText size={12} weight="semi" color={theme.colors.teal}>Search</AppText>
                </Pressable>
              </View>
              {users.map((u, i) => (
                <View key={u.id} style={[styles.userRow, i !== users.length - 1 && styles.divider]} testID={`admin-user-${i}`}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText weight="semi" size={13}>{u.name || u.email}</AppText>
                      {u.is_admin && (
                        <View style={styles.adminTag}><AppText size={9} weight="bold" color={theme.colors.warning}>ADMIN</AppText></View>
                      )}
                      {u.subscription?.plan === 'pro' && (
                        <View style={styles.proTag}><AppText size={9} weight="bold" color={theme.colors.teal}>PRO</AppText></View>
                      )}
                    </View>
                    <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                      {u.email} · {new Date(u.created_at).toLocaleDateString()}
                    </AppText>
                  </View>
                  {!u.is_admin && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {u.subscription?.plan === 'pro' ? (
                        <Pressable onPress={() => cancelSub(u.id)} style={styles.iconBtn} testID={`admin-cancel-${i}`}>
                          <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => setPlan(u.id, 'pro')} style={styles.iconBtn} testID={`admin-grant-pro-${i}`}>
                          <Ionicons name="diamond" size={16} color={theme.colors.teal} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              ))}
              {users.length === 0 && (
                <AppText size={12} color={theme.colors.textDim} style={{ padding: 12, textAlign: 'center' }}>
                  No users match
                </AppText>
              )}
            </GlassCard>
          )}

          {tab === 'broadcast' && (
            <GlassCard testID="admin-broadcast-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Push to all users
              </AppText>
              <TextInput
                style={styles.bcInput}
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
                placeholder="Title"
                placeholderTextColor={theme.colors.textMute}
                testID="admin-broadcast-title"
              />
              <TextInput
                style={[styles.bcInput, { minHeight: 100, textAlignVertical: 'top' }]}
                value={broadcastBody}
                onChangeText={setBroadcastBody}
                placeholder="Message"
                placeholderTextColor={theme.colors.textMute}
                multiline
                testID="admin-broadcast-body"
              />
              <View style={{ height: 12 }} />
              <PrimaryButton
                title={busy ? 'Sending…' : 'Send broadcast'}
                onPress={broadcast}
                loading={busy}
                disabled={!broadcastTitle || !broadcastBody}
                testID="admin-broadcast-send"
                icon={<Ionicons name="megaphone" size={16} color="#fff" />}
              />
              <AppText size={10} color={theme.colors.textMute} style={{ marginTop: 10 }}>
                Sends an Expo Push to every user with a registered device token. Users without tokens are skipped.
              </AppText>
            </GlassCard>
          )}

          {tab === 'audit' && (
            <>
              <GlassCard testID="admin-audit-card">
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  Recent sync events ({audit.sync_events.length})
                </AppText>
                {audit.sync_events.slice(0, 15).map((e: any, i: number) => (
                  <View key={e.id} style={[styles.eventRow, i !== 14 && styles.divider]}>
                    <Ionicons name="sync" size={12} color={theme.colors.teal} />
                    <AppText size={11} style={{ marginLeft: 8, flex: 1 }}>{e.metric}</AppText>
                    <AppText size={10} color={theme.colors.textDim}>{e.source} → {e.destination}</AppText>
                    <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 8 }}>
                      {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </AppText>
                  </View>
                ))}
              </GlassCard>
              <GlassCard style={{ marginTop: theme.space.md }}>
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  Recent notifications ({audit.notifications.length})
                </AppText>
                {audit.notifications.slice(0, 10).map((n: any, i: number) => (
                  <View key={n.id} style={[styles.eventRow, i !== 9 && styles.divider]}>
                    <Ionicons name="notifications" size={12} color={theme.colors.warning} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <AppText size={11} weight="semi">{n.title}</AppText>
                      <AppText size={10} color={theme.colors.textDim} numberOfLines={1}>{n.body}</AppText>
                    </View>
                    <AppText size={10} color={n.status === 'sent' ? theme.colors.emerald : theme.colors.danger}>
                      {n.status}
                    </AppText>
                  </View>
                ))}
                {audit.notifications.length === 0 && (
                  <AppText size={11} color={theme.colors.textDim} style={{ padding: 8 }}>
                    No push notifications sent yet.
                  </AppText>
                )}
              </GlassCard>
            </>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value, icon, tone, testID }: any) {
  return (
    <GlassCard style={styles.statCard} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: `${tone}22`, borderColor: `${tone}55` }]}>
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 8 }}>{label}</AppText>
      <AppText weight="heading" size={22} style={{ marginTop: 2, letterSpacing: -0.5 }}>{value}</AppText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.glass,
  },
  tabs: {
    flexDirection: 'row', paddingHorizontal: theme.space.lg, gap: 6,
    paddingBottom: 8, flexWrap: 'wrap',
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.glass,
  },
  tabBtnActive: { borderColor: 'rgba(45,212,191,0.5)', backgroundColor: 'rgba(45,212,191,0.1)' },
  scroll: { padding: theme.space.lg, paddingTop: theme.space.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: Platform.OS === 'web' ? 200 : '48%', padding: theme.space.md, minHeight: 100 },
  statIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontFamily: theme.font.body, fontSize: 13, outlineStyle: 'none' as any },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  adminTag: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  proTag: { backgroundColor: 'rgba(45,212,191,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
  },
  bcInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    padding: 12, color: theme.colors.text, fontFamily: theme.font.body, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 10,
    outlineStyle: 'none' as any,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
