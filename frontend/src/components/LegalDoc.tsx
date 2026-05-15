import React from 'react';
import { ScrollView, View, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';

export const PRIVACY_BODY = `_Last updated: 15 May 2026_

HealthBridge Vault ("we", "us", "the app") is operated by HealthBridge Labs. We have built this product around a simple promise: **your health data is yours and only yours**.

## 1. Information we collect
Account: email, optional name, bcrypt-hashed password.
Health & wellness data: steps, heart rate, sleep, blood oxygen, ECG, workouts, calories, stand. Only the metrics you explicitly enable sync to the app's encrypted vault.
Connected watches: model, battery, last-sync timestamp.
Subscription: Stripe customer ID, plan, period end, cancel flag. We never see your card number.
Push tokens: Expo push token for opt-in notifications.
Device: platform, app version.

We do NOT collect: precise location, contacts, photos, microphone, advertising identifiers.

## 2. How we use it
To run the cross-ecosystem bridge, resolve conflicts, deliver opted-in notifications, process subscription payments via Stripe, respond to support.

## 3. How we don't use it
We never sell your data. Never share with advertisers or brokers. Never use HealthKit data for non-health purposes. Never read your encrypted vault contents.

## 4. Encryption & security
TLS 1.3 in transit. AES-256 at rest. JWT tokens stored on iOS Keychain / Android Keystore. Biometric gate on the Privacy Vault. Independent audit log of every sync.

## 5. Your rights
Access: Settings → Data & Privacy → Export Vault (JSON/CSV/GPX).
Deletion: Settings → Delete Account, or email privacy@healthbridge.app.
Portability: full archive in machine-readable formats anytime.
Opt-out: per-metric sync toggles + global background-sync switch.

## 6. Sub-processors
Stripe (billing). Expo (push tokens only). MongoDB Atlas (encrypted DB).

## 7. Children
Not directed at users under 13.

## 8. Changes
We will notify you in-app and by email before any material change.

## 9. Contact
HealthBridge Labs, privacy@healthbridge.app.
EU Representative: Hera Compliance s.r.o., Prague, CZ.
California: dataprotection-ca@healthbridge.app.`;

export const TERMS_BODY = `_Last updated: 15 May 2026_

By installing or using HealthBridge Vault you agree to these Terms.

## 1. Account
You must be at least 13. You're responsible for keeping your password secure.

## 2. Health information disclaimer
HealthBridge Vault is NOT a medical device. It does not diagnose, treat or prevent any condition.

## 3. Subscriptions (HealthBridge PRO)
$4.99/month or $49.99/year via Stripe. All new accounts receive a 30-day PRO trial. Auto-renews until cancelled in Settings or Stripe Customer Portal. No refunds for partial periods unless required by local law.

## 4. Acceptable use
No reverse-engineering, no bypassing the Privacy Vault, no illegal use, no automation of accounts or syncs.

## 5. Intellectual property
All rights belong to HealthBridge Labs. You receive a personal, non-exclusive, revocable licence.

## 6. Termination
We may suspend for breach. You may close your account anytime — data permanently deleted within 30 days.

## 7. Limitation of liability
To the maximum extent permitted by law, total liability is capped at the greater of $50 or amount paid in the previous 12 months.

## 8. Changes
We may update these Terms with 14-day advance notice for material changes.

## 9. Governing law
State of Delaware, USA. Disputes resolved in New Castle County, Delaware.

## 10. Contact
support@healthbridge.app`;

export function LegalDoc({ title, body, testID }: { title: string; body: string; testID: string }) {
  const router = useRouter();
  return (
    <View style={styles.root} testID={testID}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
            hitSlop={12}
            testID={`${testID}-back`}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.head}>
            <AppText weight="heading" size={32} style={{ letterSpacing: -0.5 }}>{title}</AppText>
            <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 6 }}>
              HealthBridge Vault · Public legal documentation
            </AppText>
          </View>
          <GlassCard>
            {body.split('\n').map((line, i) => {
              const t = line.trim();
              if (!t) return <View key={i} style={{ height: 8 }} />;
              if (t.startsWith('## ')) {
                return (
                  <AppText
                    key={i}
                    weight="heading"
                    size={17}
                    style={{ marginTop: 18, marginBottom: 6, letterSpacing: -0.3 }}
                  >
                    {t.replace('## ', '')}
                  </AppText>
                );
              }
              if (t.startsWith('_') && t.endsWith('_')) {
                return (
                  <AppText
                    key={i}
                    size={11}
                    color={theme.colors.textDim}
                    style={{ marginBottom: 12, fontStyle: 'italic' }}
                  >
                    {t.slice(1, -1)}
                  </AppText>
                );
              }
              // Render bold inline **...**
              const parts = t.split(/(\*\*[^*]+\*\*)/g);
              return (
                <AppText key={i} size={13} color={theme.colors.text} style={{ lineHeight: 20, marginBottom: 8 }}>
                  {parts.map((p, j) =>
                    p.startsWith('**') && p.endsWith('**')
                      ? <AppText key={j} weight="semi" size={13}>{p.slice(2, -2)}</AppText>
                      : p,
                  )}
                </AppText>
              );
            })}
          </GlassCard>
          <View style={{ height: 80 }} />
          <View style={styles.footer}>
            <AppText size={10} color={theme.colors.textMute} style={{ textAlign: 'center' }}>
              © 2026 HealthBridge Labs · support@healthbridge.app
            </AppText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.space.lg, maxWidth: Platform.OS === 'web' ? 760 : undefined, width: '100%', alignSelf: 'center' as any },
  back: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
  },
  head: { marginTop: theme.space.lg, marginBottom: theme.space.lg },
  footer: { paddingVertical: 24 },
});
