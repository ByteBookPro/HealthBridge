import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp, FadeIn, FadeInDown, FadeInRight,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, 
  withSequence, withDelay, Easing, interpolate
} from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Feature highlights
const FEATURES = [
  { 
    icon: 'fitness-outline' as const, 
    title: 'All Your Health Data', 
    desc: '33+ metrics from Activity, Exercise, Nutrition, Body & Vitals in one place',
    color: '#2DD4BF'
  },
  { 
    icon: 'sync' as const, 
    title: 'Multi-Device Sync', 
    desc: 'Apple Watch, Galaxy Watch, Fitbit, Garmin - all connected seamlessly',
    color: '#3B82F6'
  },
  { 
    icon: 'sparkles' as const, 
    title: 'AI Health Insights', 
    desc: 'Personalized analysis and recommendations powered by advanced AI',
    color: '#F59E0B'
  },
  { 
    icon: 'shield-checkmark' as const, 
    title: 'Bank-Level Security', 
    desc: 'Biometric lock, end-to-end encryption. Your data stays yours.',
    color: '#10B981'
  },
];

// Connected platforms
const PLATFORMS = [
  { name: 'Apple Health', icon: 'logo-apple', color: '#F3F4F6' },
  { name: 'Samsung Health', icon: 'phone-portrait-outline', color: '#3B82F6' },
  { name: 'Google Fit', icon: 'logo-google', color: '#EA4335' },
  { name: 'Fitbit', icon: 'fitness-outline', color: '#00B0B9' },
  { name: 'Garmin', icon: 'navigate-outline', color: '#007DC3' },
];

// Animated health metric pill component
function MetricPill({ label, value, delay, color }: { label: string; value: string; delay: number; color: string }) {
  return (
    <Animated.View 
      entering={FadeInRight.delay(delay).duration(600)}
      style={[styles.metricPill, { borderColor: `${color}40` }]}
    >
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <AppText size={10} color={theme.colors.textDim}>{label}</AppText>
      <AppText size={12} weight="semi" color={color}>{value}</AppText>
    </Animated.View>
  );
}

// Animated ring component
function AnimatedRing({ size, delay, color }: { size: number; delay: number; color: string }) {
  const progress = useSharedValue(0);
  
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(0.75, { duration: 1500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));
  
  return (
    <Animated.View style={[{ width: size, height: size, position: 'absolute' }, animatedStyle]}>
      <View style={[styles.ring, { width: size, height: size, borderColor: `${color}30` }]}>
        <View style={[styles.ringProgress, { 
          width: size, 
          height: size, 
          borderColor: color,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
        }]} />
      </View>
    </Animated.View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  
  // Floating animation for hero elements
  const floatY = useSharedValue(0);
  const pulse = useSharedValue(1);
  
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);
  
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.root} testID="onboarding-screen">
      <AuroraBackground />
      
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#2DD4BF', '#10B981']}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="heart-half" size={16} color="#fff" style={styles.logoIcon} />
            </View>
            <AppText weight="heading" size={18} style={{ marginLeft: 10 }}>HealthBridge</AppText>
            <View style={{ flex: 1 }} />
            <View style={styles.versionBadge}>
              <AppText size={10} weight="semi" color={theme.colors.teal}>PRO</AppText>
            </View>
          </Animated.View>

          {/* Hero Section with Animated Rings */}
          <View style={styles.heroSection}>
            <Animated.View style={[styles.heroVisual, floatStyle]}>
              {/* Animated activity rings */}
              <View style={styles.ringsContainer}>
                <AnimatedRing size={140} delay={0} color="#F97316" />
                <AnimatedRing size={110} delay={200} color="#10B981" />
                <AnimatedRing size={80} delay={400} color="#3B82F6" />
                <Animated.View style={[styles.ringsCenter, pulseStyle]}>
                  <Ionicons name="heart" size={28} color={theme.colors.teal} />
                </Animated.View>
              </View>
              
              {/* Floating metric pills */}
              <View style={styles.metricsFloat}>
                <MetricPill label="Steps" value="8,420" delay={600} color="#2DD4BF" />
                <MetricPill label="Heart" value="72 bpm" delay={750} color="#EF4444" />
                <MetricPill label="Sleep" value="7.4h" delay={900} color="#8B5CF6" />
              </View>
            </Animated.View>
            
            {/* Main headline */}
            <Animated.View entering={FadeInUp.delay(300).duration(700)} style={styles.headline}>
              <AppText weight="heading" size={32} style={styles.headlineText}>
                Your Health.{'\n'}
                <AppText weight="heading" size={32} color={theme.colors.teal} style={styles.headlineText}>
                  One Dashboard.
                </AppText>
              </AppText>
              <AppText size={15} color={theme.colors.textDim} style={styles.subheadline}>
                Connect all your devices and health apps. Get comprehensive insights. Take control of your wellness journey.
              </AppText>
            </Animated.View>
          </View>

          {/* Connected Platforms */}
          <Animated.View entering={FadeInUp.delay(500).duration(600)} style={styles.platformsSection}>
            <AppText size={11} color={theme.colors.textMute} weight="med" style={styles.sectionLabel}>
              CONNECTS WITH
            </AppText>
            <View style={styles.platformsRow}>
              {PLATFORMS.map((p, i) => (
                <Animated.View 
                  key={p.name}
                  entering={FadeIn.delay(600 + i * 100).duration(400)}
                  style={[styles.platformBadge, { borderColor: `${p.color}30` }]}
                >
                  <Ionicons name={p.icon as any} size={16} color={p.color} />
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* Feature Cards */}
          <View style={styles.featuresSection}>
            {FEATURES.map((f, i) => (
              <Animated.View 
                key={f.title} 
                entering={FadeInUp.delay(700 + i * 100).duration(500)}
              >
                <GlassCard style={styles.featureCard}>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureIcon, { backgroundColor: `${f.color}15`, borderColor: `${f.color}40` }]}>
                      <Ionicons name={f.icon} size={20} color={f.color} />
                    </View>
                    <View style={styles.featureContent}>
                      <AppText weight="semi" size={14}>{f.title}</AppText>
                      <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 2 }}>
                        {f.desc}
                      </AppText>
                    </View>
                  </View>
                </GlassCard>
              </Animated.View>
            ))}
          </View>

          {/* Social Proof */}
          <Animated.View entering={FadeInUp.delay(1100).duration(500)} style={styles.socialProof}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <AppText weight="heading" size={24} color={theme.colors.teal}>33+</AppText>
                <AppText size={10} color={theme.colors.textDim}>Health Metrics</AppText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <AppText weight="heading" size={24} color={theme.colors.teal}>5</AppText>
                <AppText size={10} color={theme.colors.textDim}>Platforms</AppText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <AppText weight="heading" size={24} color={theme.colors.teal}>24/7</AppText>
                <AppText size={10} color={theme.colors.textDim}>Sync</AppText>
              </View>
            </View>
          </Animated.View>

          {/* CTA Section */}
          <Animated.View entering={FadeInUp.delay(1200).duration(500)} style={styles.ctaSection}>
            <PrimaryButton
              title="Get Started Free"
              onPress={() => router.push('/(auth)/register')}
              testID="onboarding-get-started-btn"
              icon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
            />
            
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={styles.signInLink}
              testID="onboarding-sign-in-link"
            >
              <AppText size={13} color={theme.colors.textDim}>
                Already have an account?{' '}
                <AppText size={13} weight="semi" color={theme.colors.teal}>Sign in</AppText>
              </AppText>
            </Pressable>

            {/* Trust badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <Ionicons name="lock-closed" size={12} color={theme.colors.emerald} />
                <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 4 }}>
                  End-to-end encrypted
                </AppText>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="finger-print" size={12} color={theme.colors.emerald} />
                <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 4 }}>
                  Biometric secured
                </AppText>
              </View>
            </View>
            
            <View style={styles.legalRow}>
              <Pressable onPress={() => router.push('/privacy')} testID="onboarding-privacy-link" hitSlop={6}>
                <AppText size={11} color={theme.colors.textMute}>Privacy</AppText>
              </Pressable>
              <AppText size={11} color={theme.colors.textMute}> · </AppText>
              <Pressable onPress={() => router.push('/terms')} testID="onboarding-terms-link" hitSlop={6}>
                <AppText size={11} color={theme.colors.textMute}>Terms</AppText>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: theme.space.lg, paddingBottom: 40 },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: theme.space.md,
    marginBottom: theme.space.lg,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  logoIcon: {
    position: 'absolute',
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
    backgroundColor: 'rgba(45,212,191,0.1)',
  },
  
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.space.xl,
  },
  heroVisual: {
    alignItems: 'center',
    marginBottom: theme.space.lg,
  },
  ringsContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 8,
  },
  ringProgress: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 8,
  },
  ringsCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(45,212,191,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsFloat: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  // Headline
  headline: {
    alignItems: 'center',
  },
  headlineText: {
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 38,
  },
  subheadline: {
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
    lineHeight: 22,
  },
  
  // Platforms
  platformsSection: {
    alignItems: 'center',
    marginBottom: theme.space.lg,
  },
  sectionLabel: {
    letterSpacing: 2,
    marginBottom: 12,
  },
  platformsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  platformBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Features
  featuresSection: {
    gap: 10,
    marginBottom: theme.space.lg,
  },
  featureCard: {
    padding: theme.space.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: 14,
  },
  
  // Social proof
  socialProof: {
    marginBottom: theme.space.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.space.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  
  // CTA
  ctaSection: {
    alignItems: 'center',
    gap: theme.space.md,
  },
  signInLink: {
    padding: 8,
  },
  trustBadges: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 999,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
});
