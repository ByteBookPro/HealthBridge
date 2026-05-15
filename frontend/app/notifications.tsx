import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, Platform, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';
import { NotificationBridge } from '@/src/services/notificationBridge';

const APPS = [
  { key: 'messages', label: 'Messages', icon: 'chatbubble-ellipses' as const, color: '#10B981' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' as const, color: '#22C55E' },
  { key: 'calls', label: 'Calls', icon: 'call' as const, color: '#3B82F6' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' as const, color: '#F59E0B' },
  { key: 'email', label: 'Email', icon: 'mail' as const, color: '#EC4899' },
  { key: 'social', label: 'Social', icon: 'heart' as const, color: '#8B5CF6' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>({ enabled: true, apps_allowed: ['messages', 'whatsapp', 'calls', 'calendar'] });
  const [log, setLog] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.notifSettings(), api.notifLog(40)]);
      setSettings(s); setLog(l);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next: any) => {
    setSettings(next);
    try { await api.updateNotifSettings(next); } catch {}
  };

  const toggleApp = (key: string) => {
    const allowed = settings.apps_allowed.includes(key)
      ? settings.apps_allowed.filter((k: string) => k !== key)
      : [...settings.apps_allowed, key];
    save({ ...settings, apps_allowed: allowed });
  };

  const sendTest = async () => {
    const sample = { app: 'messages', title: 'Mom', body: 'Are you home for dinner? 🍝' };
    const ok = NotificationBridge.available()
      ? await NotificationBridge.forwardToWatch(sample)
      : await NotificationBridge.demoForward(sample);
    Alert.alert(ok ? 'Forwarded' : 'Could not forward',
      ok ? 'A demo notification was relayed to your Galaxy Watch and the audit log.' : 'Bridge unavailable.');
    await load();
  };

  return (
    <View style={styles.root} testID="notifications-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.colors.teal} />}
        >
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} testID="notif-back">
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>

          <View style={styles.head}>
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Notification Bridge</AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6, lineHeight: 19 }}>
              Forward iPhone notifications to your paired Galaxy Watch over BLE — calls, texts, WhatsApp, calendar.
            </AppText>
          </View>

          <Animated.View entering={FadeInUp.duration(400)}>
            <GlassCard glow testID="notif-status-card">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.statusOrb, { backgroundColor: settings.enabled ? 'rgba(16,185,129,0.15)' : theme.colors.glass, borderColor: settings.enabled ? 'rgba(16,185,129,0.4)' : theme.colors.border }]}>
                  <Ionicons name="bluetooth" size={20} color={settings.enabled ? theme.colors.emerald : theme.colors.textMute} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={15}>{settings.enabled ? 'Bridge active' : 'Bridge paused'}</AppText>
                  <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                    {NotificationBridge.available() ? 'Native BLE' : 'Demo mode (Expo Go)'}
                  </AppText>
                </View>
                <Switch
                  value={settings.enabled}
                  onValueChange={(v) => save({ ...settings, enabled: v })}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(45,212,191,0.4)' }}
                  thumbColor={settings.enabled ? theme.colors.teal : '#777'}
                  ios_backgroundColor="rgba(255,255,255,0.1)"
                  testID="notif-master-toggle"
                />
              </View>
              <View style={{ height: 14 }} />
              <PrimaryButton
                title="Send a test to my watch"
                variant="secondary"
                onPress={sendTest}
                testID="notif-test-btn"
                icon={<Ionicons name="paper-plane" size={14} color="#fff" />}
              />
            </GlassCard>
          </Animated.View>

          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
            Which apps to forward
          </AppText>
          <GlassCard style={{ paddingVertical: 8 }}>
            {APPS.map((a, i) => {
              const on = settings.apps_allowed.includes(a.key);
              return (
                <View
                  key={a.key}
                  style={[styles.row, i !== APPS.length - 1 && styles.divider]}
                >
                  <View style={[styles.appIcon, { backgroundColor: `${a.color}22`, borderColor: `${a.color}55` }]}>
                    <Ionicons name={a.icon} size={16} color={a.color} />
                  </View>
                  <AppText weight="semi" size={14} style={{ marginLeft: 12, flex: 1 }}>{a.label}</AppText>
                  <Switch
                    value={on}
                    onValueChange={() => toggleApp(a.key)}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(45,212,191,0.4)' }}
                    thumbColor={on ? theme.colors.teal : '#777'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                    testID={`notif-app-${a.key}`}
                  />
                </View>
              );
            })}
          </GlassCard>

          <View style={styles.logHead}>
            <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
              Recent forwards ({log.length})
            </AppText>
            <View style={styles.live}>
              <View style={[styles.dot, { backgroundColor: theme.colors.emerald }]} />
              <AppText size={10} color={theme.colors.emerald} weight="semi">LIVE</AppText>
            </View>
          </View>

          <GlassCard testID="notif-log-card">
            {log.length === 0 ? (
              <AppText size={12} color={theme.colors.textDim} style={{ padding: 8, textAlign: 'center' }}>
                No forwards yet. Tap "Send a test" above.
              </AppText>
            ) : log.map((l, i) => (
              <View key={l.id} style={[styles.logRow, i !== log.length - 1 && styles.divider]}>
                <View style={styles.logIcon}>
                  <Ionicons name="notifications" size={12} color={theme.colors.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText weight="semi" size={13}>{l.title}</AppText>
                    <View style={styles.appTag}>
                      <AppText size={9} weight="semi" color={theme.colors.textDim}>{l.app.toUpperCase()}</AppText>
                    </View>
                  </View>
                  {!!l.body && <AppText size={11} color={theme.colors.textDim} numberOfLines={1} style={{ marginTop: 2 }}>{l.body}</AppText>}
                </View>
                <AppText size={10} color={theme.colors.textMute}>
                  {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </AppText>
              </View>
            ))}
          </GlassCard>

          <View style={{ height: 120 }} />
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
  statusOrb: {
    width: 52, height: 52, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginTop: theme.space.lg, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  appIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  logIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  appTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
