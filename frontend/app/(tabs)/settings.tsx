import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, Alert, Platform, TextInput, Modal } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { useAuth } from '@/src/context/AuthContext';
import { api, type ConflictPolicy } from '@/src/api/client';

export default function Settings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [policy, setPolicy] = useState<ConflictPolicy | null>(null);

  const load = useCallback(async () => {
    try { setPolicy(await api.policy()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePolicy = async (key: 'background_sync' | 'notifications') => {
    if (!policy) return;
    const next = { ...policy, [key]: !policy[key] };
    setPolicy(next);
    try { await api.updatePolicy(next); } catch {}
  };

  return (
    <View style={styles.root} testID="settings-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.head}>
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Settings</AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 4 }}>
              Control your bridge, your data, your peace of mind.
            </AppText>
          </View>

          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard testID="profile-card">
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <AppText weight="heading" size={20} color={theme.colors.teal}>
                    {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </AppText>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={16}>{user?.name || user?.email || 'You'}</AppText>
                  <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 2 }}>{user?.email}</AppText>
                </View>
                {user?.subscription?.plan === 'pro' ? (
                  <View style={styles.proBadge}>
                    <Ionicons name="diamond" size={10} color={theme.colors.teal} />
                    <AppText size={10} weight="semi" color={theme.colors.teal} style={{ marginLeft: 4 }}>PRO</AppText>
                  </View>
                ) : (
                  <View style={[styles.proBadge, { borderColor: theme.colors.border, backgroundColor: theme.colors.glass }]}>
                    <AppText size={10} weight="semi" color={theme.colors.textDim}>FREE</AppText>
                  </View>
                )}
              </View>
            </GlassCard>
          </Animated.View>

          {/* PRO upgrade / manage */}
          <Animated.View entering={FadeInDown.delay(40).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} glow testID="pro-card">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="diamond" size={20} color={theme.colors.teal} />
                <AppText weight="heading" size={18} style={{ marginLeft: 10, letterSpacing: -0.3 }}>
                  {user?.subscription?.plan === 'pro' ? 'HealthBridge PRO' : 'Upgrade to PRO'}
                </AppText>
              </View>
              <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8, lineHeight: 18 }}>
                Multi-watch bridge · Raw archive export (CSV/JSON/GPX) · Real-time push · Priority support
              </AppText>
              <View style={{ height: 14 }} />
              {user?.subscription?.plan === 'pro' ? (
                <PrimaryButton
                  title="Manage Subscription"
                  variant="secondary"
                  onPress={async () => {
                    try {
                      const r = await api.portal();
                      if (Platform.OS === 'web') window.open(r.url, '_blank');
                      else await WebBrowser.openBrowserAsync(r.url);
                    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); }
                  }}
                  testID="manage-sub-btn"
                  icon={<Ionicons name="card-outline" size={16} color="#fff" />}
                />
              ) : (
                <PrimaryButton
                  title="Subscribe — $4.99/mo"
                  onPress={async () => {
                    try {
                      const r = await api.checkout();
                      if (Platform.OS === 'web') window.open(r.url, '_blank');
                      else await WebBrowser.openBrowserAsync(r.url);
                    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); }
                  }}
                  testID="subscribe-btn"
                  icon={<Ionicons name="rocket" size={16} color="#fff" />}
                />
              )}
            </GlassCard>
          </Animated.View>

          {user?.is_admin && (
            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              <GlassCard style={{ marginTop: theme.space.md }}>
                <Pressable onPress={() => router.push('/admin')} style={styles.row} testID="open-admin-btn">
                  <View style={[styles.rowIcon, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' }]}>
                    <Ionicons name="shield-checkmark" size={16} color={theme.colors.warning} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText weight="semi" size={14}>Open Admin Portal</AppText>
                    <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                      CRM, subscriptions, broadcast push, audit log
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMute} />
                </Pressable>
              </GlassCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Sync & Notifications
              </AppText>
              <ToggleRow
                icon="cloud-upload-outline"
                title="Background Sync"
                desc="Continuously bridge across ecosystems"
                value={!!policy?.background_sync}
                onChange={() => togglePolicy('background_sync')}
                testID="settings-bg-sync"
              />
              <ToggleRow
                icon="notifications-outline"
                title="Sync Notifications"
                desc="Alerts when fresh data arrives from the other ecosystem"
                value={!!policy?.notifications}
                onChange={() => togglePolicy('notifications')}
                testID="settings-notifications"
                last
              />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Data & Privacy
              </AppText>
              <LinkRow icon="lock-closed-outline" title="Privacy Vault" desc="Biometric-gated archive" onPress={() => router.push('/(tabs)/vault')} testID="settings-vault" />
              <LinkRow icon="shield-checkmark-outline" title="Permissions" desc="HealthKit · Health Connect · Samsung Health" onPress={() => Alert.alert('Permissions', 'Manage health permissions in a dev build via OS-level settings.')} testID="settings-permissions" />
              <LinkRow icon="document-text-outline" title="Audit Log" desc="Every sync, every direction" onPress={() => router.push('/(tabs)/sync')} testID="settings-audit" last />
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                About
              </AppText>
              <LinkRow icon="information-circle-outline" title="Version" desc="HealthBridge Vault · v1.0.0" />
              <LinkRow icon="heart-outline" title="Send Feedback" desc="Tell us what to bridge next" onPress={() => Alert.alert('Thank you', 'Feedback noted ❤︎')} last />
            </GlassCard>
          </Animated.View>

          <View style={{ height: theme.space.lg }} />
          <PrimaryButton
            title="Sign Out"
            variant="danger"
            onPress={async () => {
              await logout();
              router.replace('/onboarding');
            }}
            testID="settings-signout-btn"
            icon={<Ionicons name="log-out-outline" size={18} color="#fff" />}
          />
          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ToggleRow({
  icon, title, desc, value, onChange, testID, last,
}: {
  icon: keyof typeof Ionicons.glyphMap; title: string; desc: string;
  value: boolean; onChange: () => void; testID?: string; last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.teal} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <AppText weight="semi" size={14}>{title}</AppText>
        <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>{desc}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(45,212,191,0.4)' }}
        thumbColor={value ? theme.colors.teal : '#777'}
        ios_backgroundColor="rgba(255,255,255,0.1)"
        testID={testID}
      />
    </View>
  );
}

function LinkRow({
  icon, title, desc, onPress, testID, last,
}: {
  icon: keyof typeof Ionicons.glyphMap; title: string; desc: string;
  onPress?: () => void; testID?: string; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, !last && styles.divider]}
      testID={testID}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.teal} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <AppText weight="semi" size={14}>{title}</AppText>
        <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>{desc}</AppText>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={theme.colors.textMute} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.space.lg },
  head: { marginTop: theme.space.sm, marginBottom: theme.space.lg },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  profile: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  proBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)', backgroundColor: 'rgba(45,212,191,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
});
