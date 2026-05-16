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
import { api, type AdminStats, type User, type AdminConnectorStat, type AdminDeviceStats, type AdminEngagement, type AdminHealthReport, type AdminUserDetail } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

type Tab = 'overview' | 'users' | 'connectors' | 'engagement' | 'broadcast' | 'audit' | 'health';

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
  const [connectorStats, setConnectorStats] = useState<AdminConnectorStat[]>([]);
  const [deviceStats, setDeviceStats] = useState<AdminDeviceStats | null>(null);
  const [engagement, setEngagement] = useState<AdminEngagement | null>(null);
  const [health, setHealth] = useState<AdminHealthReport | null>(null);
  const [billingHealth, setBillingHealth] = useState<any | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [s, u, a, c, d, e, h, bh] = await Promise.all([
        api.adminStats(),
        api.adminUsers(),
        api.adminAudit(),
        api.adminConnectorStats().catch(() => ({ connectors: [] })),
        api.adminDeviceStats().catch(() => null),
        api.adminEngagement().catch(() => null),
        api.adminSystemHealth().catch(() => null),
        api.adminBillingHealth().catch(() => null),
      ]);
      setStats(s); setUsers(u); setAudit(a);
      setConnectorStats(c.connectors); setDeviceStats(d);
      setEngagement(e); setHealth(h); setBillingHealth(bh);
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

  const openUserDetail = async (uid: string) => {
    setUserDetail(null);
    setUserDetailLoading(true);
    try {
      const d = await api.adminUserDetail(uid);
      setUserDetail(d);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not load user');
    } finally {
      setUserDetailLoading(false);
    }
  };

  const deleteUser = async (uid: string, email: string) => {
    const confirm = Platform.OS === 'web'
      ? (globalThis as any).confirm?.(`Permanently delete ${email}? This wipes all data and cannot be undone.`)
      : await new Promise<boolean>((res) => Alert.alert(
          'Delete user', `Permanently delete ${email}? This wipes all data and cannot be undone.`,
          [{ text: 'Cancel', onPress: () => res(false), style: 'cancel' },
           { text: 'Delete', onPress: () => res(true), style: 'destructive' }],
        ));
    if (!confirm) return;
    try {
      await api.adminDeleteUser(uid);
      setUserDetail(null);
      await loadAll();
      Alert.alert('Deleted', `${email} has been removed.`);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not delete');
    }
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
            { k: 'connectors', label: 'Connectors', icon: 'apps' },
            { k: 'engagement', label: 'Engagement', icon: 'pulse' },
            { k: 'broadcast', label: 'Broadcast', icon: 'megaphone' },
            { k: 'audit', label: 'Audit', icon: 'shield-checkmark' },
            { k: 'health', label: 'Health', icon: 'medkit' },
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
                <Pressable
                  key={u.id}
                  onPress={() => openUserDetail(u.id)}
                  style={[styles.userRow, i !== users.length - 1 && styles.divider]}
                  testID={`admin-user-${i}`}
                >
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
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.textMute} style={{ alignSelf: 'center' }} />
                    </View>
                  )}
                </Pressable>
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
          {tab === 'connectors' && (
            <GlassCard testID="admin-connectors-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Adoption by data source
              </AppText>
              {connectorStats.length === 0 && (
                <AppText size={12} color={theme.colors.textDim} style={{ padding: 8 }}>
                  No connector data yet — users haven't connected any apps.
                </AppText>
              )}
              {connectorStats.map((c, i) => (
                <View key={c.connector_id} style={[styles.connectorRow, i !== connectorStats.length - 1 && styles.divider]} testID={`admin-connector-${c.connector_id}`}>
                  <View style={[styles.connectorIcon, { backgroundColor: `${c.color}20`, borderColor: `${c.color}50` }]}>
                    <Ionicons name={c.icon as any} size={16} color={c.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <AppText weight="semi" size={13}>{c.name}</AppText>
                    <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                      {c.connected_seats}/{c.total_seats} users connected
                    </AppText>
                    <View style={styles.adoptionTrack}>
                      <View style={[styles.adoptionFill, { width: `${c.adoption_pct}%`, backgroundColor: c.color }]} />
                    </View>
                  </View>
                  <AppText weight="heading" size={16} color={c.color} style={{ marginLeft: 10 }}>
                    {c.adoption_pct}%
                  </AppText>
                </View>
              ))}
              {deviceStats && (
                <View style={styles.deviceSummary} testID="admin-device-stats">
                  <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                    Device profiles
                  </AppText>
                  <View style={styles.deviceStatsGrid}>
                    <DeviceStat label="Total devices" value={deviceStats.total_devices} />
                    <DeviceStat label="Multi-device users" value={deviceStats.users_with_devices} />
                    <DeviceStat label="Max / user" value={deviceStats.max_devices_per_user} />
                    <DeviceStat label="Avg / user" value={deviceStats.avg_devices_per_user.toFixed(2)} />
                  </View>
                  {deviceStats.platforms.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {deviceStats.platforms.map((p) => (
                        <View key={p.platform} style={styles.platformChip}>
                          <AppText size={10} color={theme.colors.text}>{p.platform}: {p.count}</AppText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          )}

          {tab === 'engagement' && (
            <View testID="admin-engagement-card">
              <View style={styles.statsGrid}>
                <Stat label="DAU" value={engagement?.dau ?? '—'} icon="flash-outline" tone="#2DD4BF" testID="stat-dau" />
                <Stat label="WAU" value={engagement?.wau ?? '—'} icon="calendar-outline" tone="#3B82F6" testID="stat-wau" />
                <Stat label="MAU" value={engagement?.mau ?? '—'} icon="calendar-number-outline" tone="#8B5CF6" testID="stat-mau" />
                <Stat label="WAU / DAU" value={engagement?.wau_dau_ratio ?? '—'} icon="repeat-outline" tone="#10B981" testID="stat-wau-dau" />
                <Stat label="New (24h)" value={engagement?.new_signups_24h ?? '—'} icon="person-add-outline" tone="#F59E0B" testID="stat-new-24h" />
                <Stat label="New (7d)" value={engagement?.new_signups_7d ?? '—'} icon="people-outline" tone="#EC4899" testID="stat-new-7d" />
              </View>
              <GlassCard style={{ marginTop: theme.space.md }}>
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  Churn signals
                </AppText>
                <View style={styles.churnRow}>
                  <View style={{ flex: 1 }}>
                    <AppText size={12} color={theme.colors.textDim}>Subscriptions scheduled to cancel</AppText>
                    <AppText weight="heading" size={28} color={theme.colors.warning} style={{ marginTop: 6 }}>
                      {engagement?.scheduled_to_churn ?? '—'}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText size={12} color={theme.colors.textDim}>Churn %</AppText>
                    <AppText weight="heading" size={28} color={theme.colors.danger} style={{ marginTop: 6 }}>
                      {engagement?.churn_pct ?? '—'}%
                    </AppText>
                  </View>
                </View>
              </GlassCard>
            </View>
          )}

          {tab === 'health' && (
            <View testID="admin-health-card">
              <GlassCard>
                <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                  System self-test
                </AppText>
                {(() => {
                  const allOk = health
                    ? Object.values(health.checks).every((c: any) => c?.ok === true) && health.ok === true
                    : false;
                  return (
                    <View style={styles.healthSummary}>
                      <Ionicons
                        name={allOk ? 'checkmark-circle' : 'alert-circle'}
                        size={28}
                        color={allOk ? theme.colors.emerald : theme.colors.danger}
                      />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <AppText weight="heading" size={18}>
                          {allOk ? 'All systems operational' : 'Issues detected'}
                        </AppText>
                        <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                          {health?.timestamp ? `Last checked ${new Date(health.timestamp).toLocaleString()}` : '—'}
                        </AppText>
                      </View>
                      <Pressable onPress={loadAll} hitSlop={6}>
                        <Ionicons name="refresh" size={20} color={theme.colors.textDim} />
                      </Pressable>
                    </View>
                  );
                })()}
                {health && Object.entries(health.checks).map(([k, v]: any, i) => (
                  <View key={k} style={[styles.healthRow, i !== Object.entries(health.checks).length - 1 && styles.divider]} testID={`admin-health-${k}`}>
                    <Ionicons
                      name={v.ok ? 'checkmark-circle' : 'alert-circle'}
                      size={16}
                      color={v.ok ? theme.colors.emerald : theme.colors.danger}
                    />
                    <AppText size={12} weight="semi" style={{ marginLeft: 8, flex: 1 }}>{k}</AppText>
                    {v.mode && (
                      <View style={styles.modeChip}>
                        <AppText size={9} color={theme.colors.textDim}>{v.mode}</AppText>
                      </View>
                    )}
                    {v.error && (
                      <AppText size={10} color={theme.colors.danger} numberOfLines={1} style={{ maxWidth: 150 }}>
                        {v.error}
                      </AppText>
                    )}
                  </View>
                ))}
              </GlassCard>

              {billingHealth && (
                <GlassCard style={{ marginTop: theme.space.md }}>
                  <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                    Stripe billing
                  </AppText>
                  <View style={styles.billingRow}>
                    <View style={{ flex: 1 }}>
                      <AppText size={11} color={theme.colors.textDim}>Mode</AppText>
                      <View style={[styles.modeChip, {
                        backgroundColor: billingHealth.stripe_key_mode === 'live' ? 'rgba(16,185,129,0.15)'
                          : billingHealth.stripe_key_mode === 'test' ? 'rgba(59,130,246,0.15)'
                          : 'rgba(245,158,11,0.15)',
                        marginTop: 4, alignSelf: 'flex-start',
                      }]}>
                        <AppText size={10} weight="semi">{billingHealth.stripe_key_mode}</AppText>
                      </View>
                    </View>
                    <View style={{ flex: 2 }}>
                      <AppText size={11} color={theme.colors.textDim}>API key</AppText>
                      <AppText size={11} style={{ fontFamily: 'monospace', marginTop: 4 }}>{billingHealth.stripe_key_masked}</AppText>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <Ionicons
                      name={billingHealth.webhook_secret_configured ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={billingHealth.webhook_secret_configured ? theme.colors.emerald : theme.colors.warning}
                    />
                    <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                      Webhook signing secret {billingHealth.webhook_secret_configured ? 'configured' : 'NOT set (dev only)'}
                    </AppText>
                  </View>
                  {billingHealth.stripe_reachable === false && billingHealth.stripe_error && (
                    <AppText size={11} color={theme.colors.danger} style={{ marginTop: 8 }}>
                      Stripe API error: {billingHealth.stripe_error}
                    </AppText>
                  )}
                </GlassCard>
              )}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>

      {/* User detail modal */}
      <Modal visible={!!userDetail || userDetailLoading} transparent animationType="slide" onRequestClose={() => setUserDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="admin-user-detail-modal">
            <View style={styles.modalHeader}>
              <AppText weight="heading" size={18}>{userDetail?.user.name || userDetail?.user.email || 'Loading…'}</AppText>
              <Pressable onPress={() => setUserDetail(null)} hitSlop={8} testID="admin-user-detail-close">
                <Ionicons name="close" size={22} color={theme.colors.textDim} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 520 }}>
              {userDetail && (
                <>
                  <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 4 }}>
                    {userDetail.user.email}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    <Pill label={`Plan: ${userDetail.user.subscription?.plan || 'free'}`} tone={userDetail.user.subscription?.plan === 'pro' ? theme.colors.teal : theme.colors.textDim} />
                    <Pill label={`Status: ${userDetail.user.subscription?.status || '—'}`} tone={theme.colors.textDim} />
                    <Pill label={`Watches: ${userDetail.watches.length}`} tone={theme.colors.text} />
                    <Pill label={`Connectors: ${userDetail.connectors_connected.length}/${userDetail.connectors_total}`} tone={theme.colors.text} />
                    <Pill label={`Devices: ${userDetail.devices.length}`} tone={theme.colors.text} />
                    <Pill label={`Goals: ${userDetail.goals.length}`} tone={theme.colors.text} />
                  </View>

                  <AppText size={11} color={theme.colors.textDim} weight="med" style={[styles.section, { marginTop: 18 }]}>
                    Connected apps
                  </AppText>
                  {userDetail.connectors_connected.length === 0 && (
                    <AppText size={11} color={theme.colors.textMute}>None connected</AppText>
                  )}
                  {userDetail.connectors_connected.map((c: any) => (
                    <View key={c.connector_id} style={styles.detailItem}>
                      <Ionicons name={c.icon as any} size={14} color={c.color} />
                      <AppText size={11} style={{ marginLeft: 8, flex: 1 }}>{c.name}</AppText>
                      <AppText size={10} color={theme.colors.textMute}>
                        {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : '—'}
                      </AppText>
                    </View>
                  ))}

                  <AppText size={11} color={theme.colors.textDim} weight="med" style={[styles.section, { marginTop: 18 }]}>
                    Devices
                  </AppText>
                  {userDetail.devices.length === 0 && (
                    <AppText size={11} color={theme.colors.textMute}>No device profiles yet</AppText>
                  )}
                  {userDetail.devices.map((d) => (
                    <View key={d.device_id} style={styles.detailItem}>
                      <Ionicons name={d.platform === 'ios' ? 'logo-apple' : d.platform === 'android' ? 'logo-android' : 'globe'} size={14} color={theme.colors.teal} />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <AppText size={11} weight="semi">{d.label}</AppText>
                        <AppText size={9} color={theme.colors.textMute}>{d.device_id.slice(0, 16)}…</AppText>
                      </View>
                      <AppText size={10} color={theme.colors.textMute}>
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : '—'}
                      </AppText>
                    </View>
                  ))}

                  <AppText size={11} color={theme.colors.textDim} weight="med" style={[styles.section, { marginTop: 18 }]}>
                    Recent syncs
                  </AppText>
                  {userDetail.recent_syncs.slice(0, 10).map((e: any, i: number) => (
                    <View key={i} style={styles.detailItem}>
                      <Ionicons name="sync" size={12} color={theme.colors.teal} />
                      <AppText size={11} style={{ marginLeft: 8, flex: 1 }}>{e.metric}</AppText>
                      <AppText size={10} color={theme.colors.textMute}>
                        {new Date(e.created_at).toLocaleString()}
                      </AppText>
                    </View>
                  ))}

                  {!userDetail.user.is_admin && (
                    <View style={{ marginTop: 24 }}>
                      <PrimaryButton
                        title="Delete user (GDPR)"
                        variant="danger"
                        onPress={() => deleteUser(userDetail.user.id, userDetail.user.email)}
                        icon={<Ionicons name="trash" size={14} color="#fff" />}
                        testID="admin-user-detail-delete"
                      />
                    </View>
                  )}
                </>
              )}
              {userDetailLoading && !userDetail && (
                <AppText size={12} color={theme.colors.textDim} style={{ padding: 20, textAlign: 'center' }}>
                  Loading user…
                </AppText>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Pill({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: theme.colors.border,
    }}>
      <AppText size={10} color={tone}>{label}</AppText>
    </View>
  );
}

function DeviceStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={{ flex: 1, minWidth: 110, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <AppText size={9} color={theme.colors.textMute} style={{ letterSpacing: 1 }}>
        {label.toUpperCase()}
      </AppText>
      <AppText weight="heading" size={18} style={{ marginTop: 4 }}>{value}</AppText>
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
  connectorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  connectorIcon: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  adoptionTrack: {
    marginTop: 6, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
  adoptionFill: { height: '100%', borderRadius: 2 },
  deviceSummary: {
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  deviceStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  platformChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.10)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
  },
  churnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  healthSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  healthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  modeChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  billingRow: { flexDirection: 'row', gap: 12 },
  modalBackdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: theme.colors.bg2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: theme.space.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    maxHeight: '85%' as any,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 4,
  },
});
