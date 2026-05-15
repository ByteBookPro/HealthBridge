import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';
import { HealthBridge } from '@/src/services/healthBridge';

type SetupPhase = 'detect' | 'platform' | 'permissions' | 'icloud' | 'healthconnect' | 'watches' | 'complete';

interface PlatformStatus {
  ios: { available: boolean; healthKitGranted: boolean; iCloudSigned: boolean };
  android: { available: boolean; healthConnectGranted: boolean; samsungHealthLinked: boolean };
  watches: { apple: boolean; samsung: boolean; fitbit: boolean; garmin: boolean; google: boolean };
}

const WATCH_BRANDS = [
  { id: 'apple', name: 'Apple Watch', icon: 'logo-apple', color: '#F3F4F6', platforms: ['ios'], setup: 'Pairs automatically with iPhone via Bluetooth' },
  { id: 'samsung', name: 'Galaxy Watch', icon: 'watch-outline', color: '#3B82F6', platforms: ['android', 'ios'], setup: 'Use Samsung Health app or Bluetooth pairing' },
  { id: 'google', name: 'Pixel Watch', icon: 'logo-google', color: '#EA4335', platforms: ['android'], setup: 'Pairs via Wear OS app' },
  { id: 'fitbit', name: 'Fitbit', icon: 'fitness-outline', color: '#00B0B9', platforms: ['android', 'ios'], setup: 'Use Fitbit app, data syncs to Health Connect' },
  { id: 'garmin', name: 'Garmin', icon: 'navigate-outline', color: '#007DC3', platforms: ['android', 'ios'], setup: 'Use Garmin Connect app' },
  { id: 'xiaomi', name: 'Xiaomi/Mi Band', icon: 'watch-outline', color: '#FF6900', platforms: ['android', 'ios'], setup: 'Use Mi Fitness or Zepp Life app' },
  { id: 'huawei', name: 'Huawei Watch', icon: 'watch-outline', color: '#C7000B', platforms: ['android'], setup: 'Use Huawei Health app' },
  { id: 'withings', name: 'Withings', icon: 'heart-outline', color: '#00A0E0', platforms: ['android', 'ios'], setup: 'Use Withings Health Mate app' },
];

export default function UniversalSetup() {
  const router = useRouter();
  const [phase, setPhase] = useState<SetupPhase>('detect');
  const [status, setStatus] = useState<PlatformStatus>({
    ios: { available: false, healthKitGranted: false, iCloudSigned: false },
    android: { available: false, healthConnectGranted: false, samsungHealthLinked: false },
    watches: { apple: false, samsung: false, fitbit: false, garmin: false, google: false },
  });
  const [selectedWatches, setSelectedWatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionStep, setPermissionStep] = useState(0);

  // Detect current platform
  useEffect(() => {
    const detect = async () => {
      const isIOS = Platform.OS === 'ios';
      const isAndroid = Platform.OS === 'android';
      const healthAvailable = HealthBridge.available();
      
      setStatus(prev => ({
        ...prev,
        ios: { ...prev.ios, available: isIOS },
        android: { ...prev.android, available: isAndroid || !isIOS }, // Web counts as Android path
      }));
      
      // Auto-advance after detection
      setTimeout(() => setPhase('platform'), 1500);
    };
    detect();
  }, []);

  const requestHealthPermissions = async () => {
    setLoading(true);
    try {
      const granted = await HealthBridge.requestPermissions();
      if (Platform.OS === 'ios') {
        setStatus(prev => ({ ...prev, ios: { ...prev.ios, healthKitGranted: granted } }));
      } else {
        setStatus(prev => ({ ...prev, android: { ...prev.android, healthConnectGranted: granted } }));
      }
      return granted;
    } catch (e) {
      console.warn('Permission request failed:', e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleWatch = (id: string) => {
    setSelectedWatches(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const completeSetup = async () => {
    setLoading(true);
    try {
      // Save setup to backend
      await api.saveHealthSetup({
        platform: Platform.OS,
        watches: selectedWatches,
        healthKitGranted: status.ios.healthKitGranted,
        healthConnectGranted: status.android.healthConnectGranted,
      });
      
      // Initial sync
      await api.syncNow();
      
      setPhase('complete');
    } catch (e) {
      console.warn('Setup save failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderDetect = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.detectIcon}>
        <View style={styles.pulseRing} />
        <View style={styles.detectIconInner}>
          <Ionicons name="search" size={48} color={theme.colors.teal} />
        </View>
      </Animated.View>
      <AppText weight="heading" size={24} style={{ marginTop: 24, textAlign: 'center' }}>
        Detecting Your Setup
      </AppText>
      <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center' }}>
        Checking available health platforms...
      </AppText>
      <View style={styles.detectList}>
        <DetectItem label="Operating System" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} done />
        <DetectItem label="Health Platform" value={Platform.OS === 'ios' ? 'Apple HealthKit' : 'Health Connect'} done={HealthBridge.available()} />
        <DetectItem label="Native Bridge" value={HealthBridge.available() ? 'Available' : 'Demo Mode'} done />
      </View>
    </View>
  );

  const renderPlatform = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.head}>
        <AppText weight="heading" size={26} style={{ letterSpacing: -0.5 }}>
          Choose Your Setup Path
        </AppText>
        <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6 }}>
          Select all devices and platforms you want to connect
        </AppText>
      </View>

      {/* Current Device */}
      <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
        Your Current Device
      </AppText>
      <GlassCard style={styles.currentDevice} glow>
        <View style={styles.deviceRow}>
          <View style={[styles.deviceIcon, { backgroundColor: Platform.OS === 'ios' ? 'rgba(243,244,246,0.12)' : 'rgba(16,185,129,0.12)' }]}>
            <Ionicons 
              name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-android'} 
              size={28} 
              color={Platform.OS === 'ios' ? '#F3F4F6' : '#10B981'} 
            />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <AppText weight="semi" size={18}>
              {Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android Phone' : 'Web Browser'}
            </AppText>
            <AppText size={12} color={theme.colors.textDim}>
              {Platform.OS === 'ios' ? 'Apple HealthKit ready' : 'Health Connect compatible'}
            </AppText>
          </View>
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.emerald} />
          </View>
        </View>
      </GlassCard>

      {/* Watch Selection */}
      <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
        Select Your Smartwatches
      </AppText>
      <View style={styles.watchGrid}>
        {WATCH_BRANDS.map((watch, idx) => {
          const isSelected = selectedWatches.includes(watch.id);
          const isCompatible = watch.platforms.includes(Platform.OS) || Platform.OS === 'web';
          return (
            <Animated.View key={watch.id} entering={FadeInRight.delay(idx * 50).duration(300)}>
              <Pressable 
                onPress={() => toggleWatch(watch.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <GlassCard style={[
                  styles.watchCard, 
                  isSelected && styles.watchCardSelected,
                  !isCompatible && styles.watchCardDisabled
                ]}>
                  <View style={[styles.watchIcon, { backgroundColor: `${watch.color}22` }]}>
                    <Ionicons name={watch.icon as any} size={24} color={watch.color} />
                  </View>
                  <AppText weight="med" size={12} style={{ marginTop: 8, textAlign: 'center' }}>
                    {watch.name}
                  </AppText>
                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.teal} />
                    </View>
                  )}
                  {!isCompatible && (
                    <AppText size={8} color={theme.colors.danger} style={{ marginTop: 2 }}>
                      {Platform.OS === 'ios' ? 'Android only' : 'iOS only'}
                    </AppText>
                  )}
                </GlassCard>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Cross-Ecosystem Info */}
      <GlassCard style={{ marginTop: theme.space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={[styles.infoIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
            <Ionicons name="sync" size={20} color="#3B82F6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText weight="semi" size={13}>Cross-Ecosystem Sync</AppText>
            <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 4, lineHeight: 16 }}>
              HealthBridge automatically syncs data between Apple Health and Health Connect. 
              Your Galaxy Watch data can appear in Apple Health and vice versa.
            </AppText>
          </View>
        </View>
      </GlassCard>

      <View style={{ height: 16 }} />
      <PrimaryButton 
        title="Continue to Permissions" 
        onPress={() => setPhase('permissions')}
        disabled={selectedWatches.length === 0}
        icon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
      />
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderPermissions = () => {
    const isIOS = Platform.OS === 'ios';
    const steps = isIOS ? [
      { title: 'Apple HealthKit', desc: 'Read and write health metrics', icon: 'heart', granted: status.ios.healthKitGranted },
      { title: 'iCloud Sync', desc: 'Access health data across devices', icon: 'cloud', granted: status.ios.iCloudSigned },
    ] : [
      { title: 'Health Connect', desc: 'Google\'s unified health API', icon: 'fitness', granted: status.android.healthConnectGranted },
      { title: 'Samsung Health', desc: 'Sync Galaxy Watch data', icon: 'watch', granted: status.android.samsungHealthLinked },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <AppText weight="heading" size={26} style={{ letterSpacing: -0.5 }}>
            Grant Permissions
          </AppText>
          <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6 }}>
            We need access to sync your health data securely
          </AppText>
        </View>

        {steps.map((step, idx) => (
          <Animated.View key={step.title} entering={FadeInRight.delay(idx * 100).duration(400)}>
            <GlassCard style={styles.permissionCard}>
              <View style={styles.permissionRow}>
                <View style={[styles.permissionIcon, step.granted && styles.permissionIconGranted]}>
                  <Ionicons name={step.icon as any} size={24} color={step.granted ? theme.colors.emerald : theme.colors.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <AppText weight="semi" size={15}>{step.title}</AppText>
                  <AppText size={11} color={theme.colors.textDim}>{step.desc}</AppText>
                </View>
                {step.granted ? (
                  <View style={styles.grantedBadge}>
                    <Ionicons name="checkmark" size={14} color={theme.colors.emerald} />
                    <AppText size={11} color={theme.colors.emerald} style={{ marginLeft: 4 }}>Granted</AppText>
                  </View>
                ) : (
                  <Pressable 
                    style={styles.grantBtn} 
                    onPress={async () => {
                      if (idx === 0) {
                        await requestHealthPermissions();
                      } else {
                        // For iCloud/Samsung Health, open settings
                        if (isIOS) {
                          Linking.openURL('App-Prefs:root=CASTLE');
                        } else {
                          Linking.openURL('market://details?id=com.samsung.android.wear');
                        }
                      }
                    }}
                  >
                    <AppText size={11} weight="semi" color={theme.colors.teal}>Grant</AppText>
                  </Pressable>
                )}
              </View>
            </GlassCard>
          </Animated.View>
        ))}

        {/* Privacy Note */}
        <GlassCard style={{ marginTop: theme.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.emerald} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <AppText weight="semi" size={13}>Privacy First</AppText>
              <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 4, lineHeight: 16 }}>
                Your health data is end-to-end encrypted. We never sell or share your data. 
                You can revoke access anytime in Settings.
              </AppText>
            </View>
          </View>
        </GlassCard>

        <View style={{ height: 16 }} />
        <PrimaryButton 
          title="Complete Setup" 
          onPress={completeSetup}
          loading={loading}
          icon={<Ionicons name="checkmark" size={16} color="#fff" />}
        />
        <Pressable onPress={() => setPhase('complete')} style={{ marginTop: 12, alignItems: 'center' }}>
          <AppText size={12} color={theme.colors.textMute}>Skip for now</AppText>
        </Pressable>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderComplete = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <View style={styles.successIcon}>
          <LinearGradient
            colors={theme.gradients.primaryBtn as any}
            style={styles.successGradient}
          >
            <Ionicons name="checkmark" size={56} color="#fff" />
          </LinearGradient>
        </View>
      </Animated.View>
      <AppText weight="heading" size={28} style={{ marginTop: 24, textAlign: 'center' }}>
        You're All Set!
      </AppText>
      <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
        HealthBridge is now connected to your devices. Your health data will sync automatically.
      </AppText>
      
      <View style={styles.summaryCard}>
        <GlassCard style={{ padding: theme.space.lg }}>
          <AppText size={11} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Connected
          </AppText>
          <View style={styles.summaryRow}>
            <Ionicons name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-android'} size={20} color={theme.colors.text} />
            <AppText size={14} weight="med" style={{ marginLeft: 12 }}>
              {Platform.OS === 'ios' ? 'iPhone + HealthKit' : 'Android + Health Connect'}
            </AppText>
          </View>
          {selectedWatches.map(wId => {
            const watch = WATCH_BRANDS.find(w => w.id === wId);
            return watch ? (
              <View key={wId} style={styles.summaryRow}>
                <Ionicons name={watch.icon as any} size={20} color={watch.color} />
                <AppText size={14} weight="med" style={{ marginLeft: 12 }}>{watch.name}</AppText>
              </View>
            ) : null;
          })}
        </GlassCard>
      </View>

      <PrimaryButton 
        title="Go to Dashboard" 
        onPress={() => router.replace('/(tabs)')}
        style={{ marginTop: 24, width: '100%' }}
        icon={<Ionicons name="home" size={16} color="#fff" />}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header with back button */}
        {phase !== 'detect' && phase !== 'complete' && (
          <View style={styles.header}>
            <Pressable 
              onPress={() => {
                if (phase === 'permissions') setPhase('platform');
                else if (phase === 'platform') router.back();
                else router.back();
              }} 
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
        )}
        
        {phase === 'detect' && renderDetect()}
        {phase === 'platform' && renderPlatform()}
        {phase === 'permissions' && renderPermissions()}
        {phase === 'complete' && renderComplete()}
      </SafeAreaView>
    </View>
  );
}

function DetectItem({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <View style={styles.detectItem}>
      <View style={[styles.detectDot, done && styles.detectDotDone]}>
        {done && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <AppText size={12} color={theme.colors.textDim}>{label}</AppText>
        <AppText size={14} weight="med">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.space.lg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
  },
  head: { marginBottom: theme.space.lg },
  sectionLabel: { marginTop: theme.space.md, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  
  // Detect phase
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.space.lg },
  detectIcon: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  detectIconInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 2, borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: 'rgba(45,212,191,0.2)',
  },
  detectList: { marginTop: 32, width: '100%' },
  detectItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  detectDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  detectDotDone: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emerald },
  
  // Platform phase
  currentDevice: { padding: theme.space.lg },
  deviceRow: { flexDirection: 'row', alignItems: 'center' },
  deviceIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  watchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  watchCard: { width: 105, padding: 12, alignItems: 'center' },
  watchCardSelected: { borderColor: theme.colors.teal, borderWidth: 2 },
  watchCardDisabled: { opacity: 0.5 },
  watchIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedCheck: { position: 'absolute', top: 6, right: 6 },
  infoIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  
  // Permissions phase
  permissionCard: { marginBottom: 12, padding: theme.space.md },
  permissionRow: { flexDirection: 'row', alignItems: 'center' },
  permissionIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  permissionIconGranted: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' },
  grantedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  grantBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(45,212,191,0.15)', borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
  },
  
  // Complete phase
  successIcon: { width: 100, height: 100 },
  successGradient: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryCard: { marginTop: 32, width: '100%' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
