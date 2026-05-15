import React from 'react';
import { View, StyleSheet, ImageBackground, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';

const HERO =
  'https://images.unsplash.com/photo-1629641538202-4bf2731a8656?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxzbWFydHdhdGNoJTIwZGFyayUyMHByZW1pdW18ZW58MHx8fHwxNzc4ODQ0Mjc1fDA&ixlib=rb-4.1.0&q=85';

const FEATURES = [
  { icon: 'sync' as const, title: 'Bidirectional Sync', desc: 'Apple Health ⇄ Samsung Health ⇄ Google Fit' },
  { icon: 'shield-checkmark' as const, title: 'Zero-Knowledge Vault', desc: 'End-to-end encrypted, never read by us' },
  { icon: 'watch' as const, title: 'Any Watch, Any Phone', desc: 'Apple Watch on Android. Galaxy Watch on iPhone.' },
];

export default function Onboarding() {
  const router = useRouter();

  return (
    <View style={styles.root} testID="onboarding-screen">
      <ImageBackground source={{ uri: HERO }} style={styles.hero} imageStyle={{ opacity: 0.55 }}>
        <LinearGradient
          colors={['rgba(5,5,7,0.1)', 'rgba(5,5,7,0.7)', 'rgba(5,5,7,1)']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <View style={styles.logo}>
            <LinearGradient
              colors={theme.gradients.bridge as any}
              style={styles.logoOrb}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <AppText weight="heading" size={16} style={{ marginLeft: 8 }}>HealthBridge Vault</AppText>
          </View>
          <View style={styles.pillBeta}>
            <AppText size={10} weight="semi" color={theme.colors.teal}>v1.0</AppText>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeIn.duration(500)} style={styles.heading}>
          <AppText weight="heading" size={Platform.OS === 'web' ? 44 : 36} style={{ letterSpacing: -1.5, lineHeight: 44 }}>
            One vault.{'\n'}
            <AppText weight="heading" size={Platform.OS === 'web' ? 44 : 36} color={theme.colors.teal} style={{ letterSpacing: -1.5, lineHeight: 44 }}>
              Every ecosystem.
            </AppText>
          </AppText>
          <AppText size={15} color={theme.colors.textDim} style={{ marginTop: 12, maxWidth: 340 }}>
            The bridge between Apple Health, Samsung Health and Google Fit. Built for people who refuse to choose.
          </AppText>
        </Animated.View>

        <View style={styles.featureStack}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInUp.delay(200 + i * 120).duration(500)}>
              <GlassCard style={styles.featCard}>
                <View style={styles.featRow}>
                  <View style={styles.featIcon}>
                    <Ionicons name={f.icon} size={18} color={theme.colors.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semi" size={14}>{f.title}</AppText>
                    <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 2 }}>{f.desc}</AppText>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInUp.delay(620).duration(500)} style={styles.cta}>
          <PrimaryButton
            title="Get Started"
            onPress={() => router.push('/(auth)/register')}
            testID="onboarding-get-started-btn"
          />
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={styles.signIn}
            testID="onboarding-sign-in-link"
          >
            <AppText size={13} color={theme.colors.textDim}>
              Already have an account?{' '}
              <AppText size={13} weight="semi" color={theme.colors.teal}>Sign in</AppText>
            </AppText>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  hero: { ...StyleSheet.absoluteFillObject, height: '65%' },
  safe: { flex: 1, paddingHorizontal: theme.space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: theme.space.md },
  logo: { flexDirection: 'row', alignItems: 'center' },
  logoOrb: { width: 24, height: 24, borderRadius: 12 },
  pillBeta: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)', backgroundColor: 'rgba(45,212,191,0.1)',
  },
  heading: { marginBottom: theme.space.lg },
  featureStack: { gap: theme.space.sm },
  featCard: { padding: theme.space.md },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
  },
  cta: { marginTop: theme.space.lg, marginBottom: theme.space.md, gap: theme.space.md },
  signIn: { alignItems: 'center', paddingVertical: 8 },
});
