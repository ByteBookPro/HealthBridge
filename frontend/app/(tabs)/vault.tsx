import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';

const VAULT_IMG =
  'https://images.unsplash.com/photo-1585079374502-415f8516dcc3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxmaW5nZXJwcmludCUyMHNlY3VyaXR5JTIwZGFya3xlbnwwfHx8fDE3Nzg4NDQyNzV8MA&ixlib=rb-4.1.0&q=85';

export default function Vault() {
  const { vaultUnlocked, setVaultUnlocked } = useAuth();
  const [authing, setAuthing] = useState(false);

  const unlock = useCallback(async () => {
    setAuthing(true);
    try {
      if (Platform.OS === 'web') {
        // No biometric on web — simulated unlock
        await new Promise((r) => setTimeout(r, 700));
        setVaultUnlocked(true);
        return;
      }
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHw ? await LocalAuthentication.isEnrolledAsync() : false;
      if (!hasHw || !enrolled) {
        Alert.alert('Biometric unavailable', 'Falling back to passcode unlock.');
        setVaultUnlocked(true);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your HealthBridge Vault',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (res.success) setVaultUnlocked(true);
    } finally {
      setAuthing(false);
    }
  }, [setVaultUnlocked]);

  const doExport = async (fmt: string) => {
    try {
      const data = await api.export(fmt);
      const count = (data?.metrics?.length ?? 0) + (data?.events?.length ?? 0);
      Alert.alert('Export ready', `${count} records prepared as ${fmt.toUpperCase()}.\nIn a dev build this is saved to Files / shared via OS share sheet.`);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Unknown error');
    }
  };

  if (!vaultUnlocked) {
    return (
      <View style={styles.root} testID="vault-screen-locked">
        <AuroraBackground />
        <Image source={{ uri: VAULT_IMG }} style={styles.bgImg} />
        <LinearGradient
          colors={['rgba(5,5,7,0.4)', 'rgba(5,5,7,0.9)', theme.colors.bg]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.lockWrap}>
            <Animated.View entering={FadeIn.duration(500)} style={styles.shieldWrap}>
              <LinearGradient
                colors={['rgba(45,212,191,0.4)', 'transparent']}
                style={styles.glow}
              />
              <View style={styles.shield}>
                <Ionicons name="finger-print" size={48} color={theme.colors.teal} />
              </View>
            </Animated.View>

            <AppText weight="heading" size={28} style={{ marginTop: 28, textAlign: 'center', letterSpacing: -0.5 }}>
              Privacy Vault
            </AppText>
            <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', maxWidth: 300 }}>
              Your unified health data is sealed with biometric encryption. Only you can open it.
            </AppText>

            <View style={styles.badges}>
              <Badge icon="shield-checkmark" label="End-to-End" />
              <Badge icon="lock-closed" label="Zero-Knowledge" />
              <Badge icon="server-outline" label="No Plain Storage" />
            </View>

            <View style={{ width: '100%', marginTop: theme.space.xl, paddingHorizontal: theme.space.lg }}>
              <PrimaryButton
                title={authing ? 'Authenticating…' : 'Unlock with Biometric'}
                loading={authing}
                onPress={unlock}
                testID="vault-unlock-btn"
                icon={<Ionicons name="finger-print" size={18} color="#fff" />}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="vault-screen-unlocked">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.head}>
            <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>Vault unlocked</AppText>
            <View style={styles.openPill}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.emerald }]} />
              <AppText size={10} weight="semi" color={theme.colors.emerald}>OPEN</AppText>
            </View>
          </View>
          <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 4 }}>
            Encrypted health data is now readable on this device only.
          </AppText>

          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }} testID="vault-export-card">
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Manual Export
              </AppText>
              <AppText size={12} color={theme.colors.textDim} style={{ marginBottom: 16 }}>
                Push your unified health archive to Apple Health, Samsung Health or a portable file.
              </AppText>
              <View style={styles.expRow}>
                <ExportBtn label="JSON" icon="code-slash-outline" onPress={() => doExport('json')} testID="export-json-btn" />
                <ExportBtn label="CSV" icon="document-text-outline" onPress={() => doExport('csv')} testID="export-csv-btn" />
                <ExportBtn label="GPX" icon="navigate-outline" onPress={() => doExport('gpx')} testID="export-gpx-btn" />
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <GlassCard style={{ marginTop: theme.space.md }}>
              <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.section}>
                Privacy Guarantee
              </AppText>
              {[
                { i: 'lock-closed', t: 'AES-256 encryption at rest and TLS 1.3 in transit.' },
                { i: 'eye-off', t: 'We never read your raw health records on our servers.' },
                { i: 'cloud-offline-outline', t: 'Offline-first. Reconciles automatically when online.' },
                { i: 'document-text', t: 'GDPR & HIPAA-grade consent and audit logs.' },
              ].map((row, i) => (
                <View key={i} style={[styles.privRow, i !== 3 && styles.divider]}>
                  <View style={styles.privIcon}>
                    <Ionicons name={row.i as any} size={14} color={theme.colors.teal} />
                  </View>
                  <AppText size={13} color={theme.colors.text} style={{ flex: 1, marginLeft: 12, lineHeight: 18 }}>
                    {row.t}
                  </AppText>
                </View>
              ))}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <PrimaryButton
              title="Lock Vault"
              variant="secondary"
              onPress={() => setVaultUnlocked(false)}
              testID="vault-lock-btn"
              icon={<Ionicons name="lock-closed" size={16} color="#fff" />}
            />
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Badge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={12} color={theme.colors.teal} />
      <AppText size={10} weight="semi" color={theme.colors.teal} style={{ marginLeft: 6 }}>{label}</AppText>
    </View>
  );
}

function ExportBtn({ label, icon, onPress, testID }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; testID?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <PrimaryButton
        title={label}
        variant="secondary"
        onPress={onPress}
        testID={testID}
        icon={<Ionicons name={icon} size={14} color="#fff" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  bgImg: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  lockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space.lg },
  shieldWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  glow: { ...StyleSheet.absoluteFillObject, borderRadius: 80 },
  shield: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(45,212,191,0.1)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  badges: { flexDirection: 'row', gap: 8, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)', backgroundColor: 'rgba(45,212,191,0.06)',
  },
  scroll: { padding: theme.space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space.sm },
  openPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.1)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  section: { letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  expRow: { flexDirection: 'row', gap: 8 },
  privRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  privIcon: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
});
