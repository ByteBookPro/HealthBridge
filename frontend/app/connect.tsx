import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';

type Path = 'apple_on_android' | 'samsung_on_iphone' | 'health_only';

const PATHS: Record<Path, { title: string; sub: string; available: boolean; steps: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] }> = {
  apple_on_android: {
    title: 'Apple Watch ↔ Android phone',
    sub: 'NOT possible at OS level',
    available: false,
    steps: [
      { icon: 'warning-outline', title: 'Why it doesn\'t work', body: 'Apple Watch requires an iPhone signed into iCloud for initial setup (Activation Lock). It cannot run without one. No app can bypass this Apple restriction.' },
      { icon: 'sparkles-outline', title: 'What we CAN do', body: 'If you used to have an iPhone, run the Migration Wizard on that old phone to export everything into our cloud, then your Android can read it via Health Connect.' },
      { icon: 'arrow-forward-circle', title: 'Recommended', body: 'Buy a Galaxy Watch 6 or Pixel Watch for Android. Use this app to keep its data also flowing into Apple Health for family on iOS.' },
    ],
  },
  samsung_on_iphone: {
    title: 'Galaxy Watch + iPhone',
    sub: 'Partial — health + notifications only',
    available: true,
    steps: [
      { icon: 'bluetooth-outline', title: 'Pair via Bluetooth', body: 'On your Galaxy Watch: Settings → Connections → Bluetooth → make discoverable. On iPhone: Settings → Bluetooth → tap the watch. Pair as a generic BLE device (PIN may be required).' },
      { icon: 'heart-outline', title: 'Grant Apple Health access', body: 'Open this app → Watches → tap "Galaxy Watch" → "Grant HealthKit access". Health Connect or Samsung Health data from a paired Android phone will sync into Apple Health.' },
      { icon: 'notifications-outline', title: 'Enable notification mirror', body: 'In this app → Notification Bridge → enable. iPhone notifications (SMS, WhatsApp, Calls, Calendar) will be forwarded to your Galaxy Watch over BLE.' },
      { icon: 'information-circle-outline', title: 'Limitations', body: 'Bixby, contactless pay, full Samsung Health apps need Android. Watch face stays in its limited iOS-paired mode.' },
    ],
  },
  health_only: {
    title: 'Just bridge health data',
    sub: 'Full feature parity, both directions',
    available: true,
    steps: [
      { icon: 'logo-apple', title: 'iOS side', body: 'Grant HealthKit read+write on first launch. Apple Watch data flows to our cloud automatically.' },
      { icon: 'logo-android', title: 'Android side', body: 'Grant Health Connect read+write (Samsung Health and Google Fit both write through Health Connect on Android 14+). Galaxy Watch data flows to our cloud.' },
      { icon: 'cloud-done-outline', title: 'Cross-write', body: 'Once both sides are connected, our normalization layer mirrors Apple→Samsung and Samsung→Apple on every sync.' },
      { icon: 'shield-checkmark', title: 'Privacy', body: 'All data is end-to-end encrypted in the Privacy Vault. We never read the raw payloads.' },
    ],
  },
};

export default function Connect() {
  const router = useRouter();
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!path) {
    return (
      <View style={styles.root} testID="connect-screen">
        <AuroraBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12} testID="connect-back">
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.head}>
              <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>What are you trying to bridge?</AppText>
              <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6 }}>
                We'll be honest about what's possible — and what isn't.
              </AppText>
            </View>

            {(Object.entries(PATHS) as [Path, typeof PATHS[Path]][]).map(([k, p], i) => (
              <Animated.View key={k} entering={FadeInRight.delay(i * 100).duration(400)}>
                <Pressable onPress={() => setPath(k)} testID={`connect-path-${k}`}>
                  <GlassCard style={[styles.pathCard, !p.available && styles.pathDisabled]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.iconWrap, !p.available && { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }]}>
                        <Ionicons
                          name={p.available ? 'checkmark-circle-outline' : 'close-circle-outline'}
                          size={22}
                          color={p.available ? theme.colors.teal : theme.colors.danger}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <AppText weight="semi" size={15}>{p.title}</AppText>
                        <AppText size={11} color={p.available ? theme.colors.emerald : theme.colors.danger} style={{ marginTop: 2 }}>
                          {p.sub}
                        </AppText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMute} />
                    </View>
                  </GlassCard>
                </Pressable>
              </Animated.View>
            ))}

            <GlassCard style={{ marginTop: theme.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={18} color={theme.colors.teal} style={{ marginTop: 2 }} />
                <AppText size={11} color={theme.colors.textDim} style={{ flex: 1, marginLeft: 8, lineHeight: 16 }}>
                  This app cannot make an Apple Watch run on Android — Apple's Activation Lock prevents it. We bridge <AppText size={11} weight="semi" color={theme.colors.text}>health data</AppText> in both directions and forward <AppText size={11} weight="semi" color={theme.colors.text}>iPhone notifications</AppText> to Galaxy Watches via BLE.
                </AppText>
              </View>
            </GlassCard>
            <View style={{ height: 120 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const cfg = PATHS[path];
  const isLast = step >= cfg.steps.length - 1;

  const finish = async () => {
    setBusy(true);
    try {
      if (path === 'health_only' || path === 'samsung_on_iphone') {
        // Touch the metrics endpoint to mark setup complete
        await api.syncNow();
      }
      router.replace(path === 'samsung_on_iphone' ? '/notifications' : '/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="connect-step-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => (step === 0 ? setPath(null) : setStep(step - 1))} style={styles.back} hitSlop={12} testID="connect-step-back">
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>

          <View style={styles.head}>
            <AppText size={11} color={theme.colors.teal} weight="med" style={{ letterSpacing: 2, textTransform: 'uppercase' }}>
              Step {step + 1} of {cfg.steps.length}
            </AppText>
            <AppText weight="heading" size={24} style={{ marginTop: 4, letterSpacing: -0.5 }}>
              {cfg.title}
            </AppText>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={theme.gradients.primaryBtn as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${((step + 1) / cfg.steps.length) * 100}%` }]}
              />
            </View>
          </View>

          <Animated.View key={step} entering={FadeInRight.duration(280)}>
            <GlassCard style={styles.stepCard} glow>
              <View style={styles.stepIconWrap}>
                <Ionicons name={cfg.steps[step].icon} size={36} color={theme.colors.teal} />
              </View>
              <AppText weight="heading" size={20} style={{ marginTop: 18, textAlign: 'center', letterSpacing: -0.3 }}>
                {cfg.steps[step].title}
              </AppText>
              <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 10, textAlign: 'center', lineHeight: 19 }}>
                {cfg.steps[step].body}
              </AppText>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 18 }} />
          <PrimaryButton
            title={isLast ? (cfg.available ? 'Finish & open app' : 'I understand') : 'Next step'}
            onPress={() => (isLast ? finish() : setStep(step + 1))}
            loading={busy}
            testID="connect-next-btn"
            icon={<Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />}
          />
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
  pathCard: { marginBottom: 10, padding: theme.space.md },
  pathDisabled: { opacity: 0.8 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stepCard: {
    padding: theme.space.xl,
    alignItems: 'center',
    minHeight: 260,
    justifyContent: 'center',
  },
  stepIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(45,212,191,0.12)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
});
