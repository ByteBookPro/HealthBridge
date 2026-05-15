import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated as RNAnimated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, FadeInRight, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'welcome' | 'permissions' | 'bluetooth' | 'pairing' | 'history' | 'goals' | 'complete';

const STEPS: { id: OnboardingStep; title: string; subtitle: string }[] = [
  { id: 'welcome', title: 'Welcome to HealthBridge', subtitle: 'Your universal health companion' },
  { id: 'permissions', title: 'Enable Health Access', subtitle: 'We need access to sync your data' },
  { id: 'bluetooth', title: 'Enable Bluetooth', subtitle: 'Connect your smartwatch wirelessly' },
  { id: 'pairing', title: 'Pair Your Watch', subtitle: 'Searching for nearby devices...' },
  { id: 'history', title: 'Import Your Data', subtitle: 'Start fresh or bring your history' },
  { id: 'goals', title: 'Set Your Goals', subtitle: 'Personalize your health journey' },
  { id: 'complete', title: 'You\'re All Set!', subtitle: 'Let\'s start your health journey' },
];

export default function SmartOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [scanning, setScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);
  const [historyOption, setHistoryOption] = useState<'fresh' | 'import' | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [goals, setGoals] = useState({ steps: 10000, sleep: 8, water: 8 });

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = (stepIndex + 1) / STEPS.length;

  // Animated pulse for scanning
  const pulseAnim = useSharedValue(1);
  
  useEffect(() => {
    if (scanning) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [scanning]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: 2 - pulseAnim.value,
  }));

  const startScanning = async () => {
    setScanning(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Simulate finding devices
    setTimeout(() => {
      setFoundDevices([
        { id: '1', name: 'Apple Watch Series 9', type: 'apple', rssi: -45, battery: 85 },
      ]);
    }, 1500);
    
    setTimeout(() => {
      setFoundDevices(prev => [...prev, 
        { id: '2', name: 'Galaxy Watch 6', type: 'samsung', rssi: -52, battery: 72 },
      ]);
    }, 2500);
    
    setTimeout(() => {
      setFoundDevices(prev => [...prev,
        { id: '3', name: 'Fitbit Sense 2', type: 'fitbit', rssi: -60, battery: 90 },
      ]);
      setScanning(false);
    }, 4000);
  };

  const pairDevice = async (device: any) => {
    setSelectedDevice(device);
    setPairing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Simulate pairing
    setTimeout(() => {
      setPairing(false);
      setPaired(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 3000);
  };

  const startImport = async () => {
    if (historyOption !== 'import') {
      setCurrentStep('goals');
      return;
    }
    
    setImporting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Simulate importing with progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setImporting(false);
          setCurrentStep('goals');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 500);
      }
      setImportProgress(progress);
    }, 300);
  };

  const completeOnboarding = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const nextStep = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  };

  const renderWelcome = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeInDown.duration(600)}>
        <View style={styles.logoContainer}>
          <LinearGradient colors={['#2DD4BF', '#10B981']} style={styles.logoGradient}>
            <Ionicons name="heart" size={48} color="#fff" />
          </LinearGradient>
        </View>
      </Animated.View>
      
      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <AppText weight="heading" size={32} style={styles.welcomeTitle}>
          HealthBridge
        </AppText>
        <AppText size={16} color={theme.colors.textDim} style={styles.welcomeSubtitle}>
          Connect any watch. Sync everywhere.{'\n'}Your health, unified.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.featureList}>
        {[
          { icon: 'watch-outline', text: 'Connect Apple Watch, Galaxy, Fitbit & more' },
          { icon: 'sync-outline', text: 'Real-time sync across all devices' },
          { icon: 'shield-checkmark-outline', text: 'Your data stays private & encrypted' },
          { icon: 'analytics-outline', text: 'AI-powered health insights' },
        ].map((f, i) => (
          <Animated.View key={i} entering={FadeInRight.delay(500 + i * 100).duration(400)} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={20} color={theme.colors.teal} />
            </View>
            <AppText size={14} color={theme.colors.textDim} style={{ flex: 1 }}>{f.text}</AppText>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(900).duration(600)} style={styles.bottomAction}>
        <PrimaryButton title="Get Started" onPress={nextStep} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} />
      </Animated.View>
    </View>
  );

  const renderPermissions = () => (
    <View style={styles.stepContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
          <Ionicons name="shield-checkmark" size={32} color="#3B82F6" />
        </View>
        <AppText weight="heading" size={24} style={{ marginTop: 16, textAlign: 'center' }}>
          Health Permissions
        </AppText>
        <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center' }}>
          We need access to read and write health data
        </AppText>
      </Animated.View>

      <View style={styles.permissionsList}>
        {[
          { icon: 'heart', title: 'Heart Rate', desc: 'Monitor your cardiovascular health', color: '#EF4444' },
          { icon: 'footsteps', title: 'Steps & Activity', desc: 'Track your daily movement', color: '#10B981' },
          { icon: 'moon', title: 'Sleep', desc: 'Analyze your sleep patterns', color: '#8B5CF6' },
          { icon: 'fitness', title: 'Workouts', desc: 'Log and sync exercises', color: '#F59E0B' },
        ].map((p, i) => (
          <Animated.View key={i} entering={FadeInRight.delay(i * 100).duration(400)}>
            <GlassCard style={styles.permissionCard}>
              <View style={[styles.permIcon, { backgroundColor: `${p.color}22` }]}>
                <Ionicons name={p.icon as any} size={22} color={p.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <AppText weight="semi" size={15}>{p.title}</AppText>
                <AppText size={12} color={theme.colors.textMute}>{p.desc}</AppText>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.emerald} />
            </GlassCard>
          </Animated.View>
        ))}
      </View>

      <View style={styles.bottomAction}>
        <PrimaryButton title="Grant Access" onPress={nextStep} icon={<Ionicons name="lock-open" size={18} color="#fff" />} />
        <Pressable onPress={nextStep} style={{ marginTop: 16 }}>
          <AppText size={13} color={theme.colors.textMute}>Skip for now</AppText>
        </Pressable>
      </View>
    </View>
  );

  const renderBluetooth = () => (
    <View style={styles.stepContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
          <Ionicons name="bluetooth" size={32} color="#3B82F6" />
        </View>
        <AppText weight="heading" size={24} style={{ marginTop: 16, textAlign: 'center' }}>
          Enable Bluetooth
        </AppText>
        <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          Bluetooth is required to connect and sync with your smartwatch
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).duration(500)}>
        <GlassCard style={styles.bluetoothCard} glow>
          <View style={styles.bluetoothVisual}>
            <View style={styles.bluetoothRing} />
            <View style={[styles.bluetoothRing, { width: 120, height: 120, opacity: 0.5 }]} />
            <View style={[styles.bluetoothRing, { width: 160, height: 160, opacity: 0.3 }]} />
            <View style={styles.bluetoothCenter}>
              <Ionicons name="bluetooth" size={40} color={theme.colors.teal} />
            </View>
          </View>
          <AppText weight="semi" size={16} style={{ marginTop: 24, textAlign: 'center' }}>
            Bluetooth is enabled
          </AppText>
          <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 4, textAlign: 'center' }}>
            Ready to discover nearby devices
          </AppText>
        </GlassCard>
      </Animated.View>

      <View style={styles.bottomAction}>
        <PrimaryButton title="Continue" onPress={nextStep} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} />
      </View>
    </View>
  );

  const renderPairing = () => (
    <View style={styles.stepContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stepHeader}>
        <AppText weight="heading" size={24} style={{ textAlign: 'center' }}>
          {paired ? 'Connected!' : scanning ? 'Searching...' : 'Find Your Watch'}
        </AppText>
        <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center' }}>
          {paired ? `${selectedDevice?.name} is now connected` : 'Make sure your watch is nearby and awake'}
        </AppText>
      </Animated.View>

      {!paired && (
        <>
          {/* Scanning animation */}
          <View style={styles.scanContainer}>
            {scanning && (
              <Animated.View style={[styles.scanPulse, pulseStyle]} />
            )}
            <Pressable 
              style={[styles.scanButton, scanning && styles.scanButtonActive]}
              onPress={!scanning ? startScanning : undefined}
            >
              <Ionicons name={scanning ? 'radio' : 'search'} size={32} color={theme.colors.teal} />
            </Pressable>
          </View>

          {/* Found devices */}
          <ScrollView style={styles.deviceList} showsVerticalScrollIndicator={false}>
            {foundDevices.map((device, i) => (
              <Animated.View key={device.id} entering={FadeInRight.delay(i * 100).duration(400)}>
                <Pressable onPress={() => pairDevice(device)}>
                  <GlassCard style={[styles.deviceCard, selectedDevice?.id === device.id && pairing && styles.deviceCardPairing]}>
                    <View style={[styles.deviceIcon, { backgroundColor: device.type === 'apple' ? 'rgba(243,244,246,0.1)' : device.type === 'samsung' ? 'rgba(59,130,246,0.15)' : 'rgba(0,176,185,0.15)' }]}>
                      <Ionicons 
                        name={device.type === 'apple' ? 'logo-apple' : 'watch-outline'} 
                        size={24} 
                        color={device.type === 'apple' ? '#E5E7EB' : device.type === 'samsung' ? '#3B82F6' : '#00B0B9'} 
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <AppText weight="semi" size={15}>{device.name}</AppText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name="battery-half" size={14} color={theme.colors.textMute} />
                        <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 4 }}>{device.battery}%</AppText>
                        <View style={styles.signalDot} />
                        <AppText size={11} color={theme.colors.textMute}>Strong signal</AppText>
                      </View>
                    </View>
                    {selectedDevice?.id === device.id && pairing ? (
                      <View style={styles.pairingIndicator}>
                        <AppText size={11} color={theme.colors.teal}>Pairing...</AppText>
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color={theme.colors.teal} />
                    )}
                  </GlassCard>
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </>
      )}

      {paired && (
        <Animated.View entering={FadeInUp.duration(500)} style={styles.pairedSuccess}>
          <View style={styles.successIcon}>
            <LinearGradient colors={['#10B981', '#2DD4BF']} style={styles.successGradient}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <GlassCard style={styles.pairedCard}>
            <View style={styles.deviceIcon}>
              <Ionicons name={selectedDevice?.type === 'apple' ? 'logo-apple' : 'watch-outline'} size={24} color={theme.colors.text} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText weight="semi" size={15}>{selectedDevice?.name}</AppText>
              <AppText size={12} color={theme.colors.emerald}>Connected & syncing</AppText>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.emerald} />
          </GlassCard>
        </Animated.View>
      )}

      <View style={styles.bottomAction}>
        {paired ? (
          <PrimaryButton title="Continue" onPress={nextStep} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} />
        ) : (
          <Pressable onPress={nextStep}>
            <AppText size={13} color={theme.colors.textMute}>Skip and add later</AppText>
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderHistory = () => (
    <View style={styles.stepContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
          <Ionicons name="time" size={32} color="#8B5CF6" />
        </View>
        <AppText weight="heading" size={24} style={{ marginTop: 16, textAlign: 'center' }}>
          Your Health History
        </AppText>
        <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
          We found {selectedDevice ? '2 years' : 'historical data'} of health data. What would you like to do?
        </AppText>
      </Animated.View>

      {!importing ? (
        <View style={styles.historyOptions}>
          <Animated.View entering={FadeInRight.delay(100).duration(400)}>
            <Pressable onPress={() => setHistoryOption('import')}>
              <GlassCard style={[styles.historyCard, historyOption === 'import' && styles.historyCardSelected]} glow={historyOption === 'import'}>
                <View style={[styles.historyIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <Ionicons name="cloud-download" size={28} color={theme.colors.emerald} />
                </View>
                <AppText weight="semi" size={16} style={{ marginTop: 12 }}>Import Full History</AppText>
                <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 6, textAlign: 'center' }}>
                  Bring all your past data including steps, heart rate, sleep, and workouts
                </AppText>
                <View style={styles.historyMeta}>
                  <Ionicons name="document-text-outline" size={14} color={theme.colors.textMute} />
                  <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 4 }}>~15,000 records</AppText>
                  <Ionicons name="time-outline" size={14} color={theme.colors.textMute} style={{ marginLeft: 12 }} />
                  <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 4 }}>~2 min</AppText>
                </View>
                {historyOption === 'import' && (
                  <View style={styles.selectedCheck}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.emerald} />
                  </View>
                )}
              </GlassCard>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInRight.delay(200).duration(400)}>
            <Pressable onPress={() => setHistoryOption('fresh')}>
              <GlassCard style={[styles.historyCard, historyOption === 'fresh' && styles.historyCardSelected]} glow={historyOption === 'fresh'}>
                <View style={[styles.historyIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="refresh" size={28} color="#3B82F6" />
                </View>
                <AppText weight="semi" size={16} style={{ marginTop: 12 }}>Start Fresh</AppText>
                <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 6, textAlign: 'center' }}>
                  Begin with a clean slate and start collecting new data from today
                </AppText>
                <View style={styles.historyMeta}>
                  <Ionicons name="sparkles-outline" size={14} color={theme.colors.textMute} />
                  <AppText size={11} color={theme.colors.textMute} style={{ marginLeft: 4 }}>New beginning</AppText>
                </View>
                {historyOption === 'fresh' && (
                  <View style={styles.selectedCheck}>
                    <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                  </View>
                )}
              </GlassCard>
            </Pressable>
          </Animated.View>
        </View>
      ) : (
        <Animated.View entering={FadeInUp.duration(500)} style={styles.importProgress}>
          <GlassCard style={styles.importCard} glow>
            <View style={styles.importVisual}>
              <View style={styles.importCircle}>
                <AppText weight="heading" size={32} color={theme.colors.teal}>{Math.round(importProgress)}%</AppText>
              </View>
            </View>
            <AppText weight="semi" size={16} style={{ marginTop: 20 }}>Importing your history...</AppText>
            <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 4 }}>
              {importProgress < 30 ? 'Reading health records...' : 
               importProgress < 60 ? 'Processing heart rate data...' :
               importProgress < 90 ? 'Syncing sleep patterns...' : 'Almost done!'}
            </AppText>
            <View style={styles.importBar}>
              <View style={[styles.importBarFill, { width: `${importProgress}%` }]} />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      <View style={styles.bottomAction}>
        {!importing && (
          <PrimaryButton 
            title={historyOption === 'import' ? 'Start Import' : 'Continue'} 
            onPress={startImport} 
            disabled={!historyOption}
            icon={<Ionicons name={historyOption === 'import' ? 'cloud-download' : 'arrow-forward'} size={18} color="#fff" />} 
          />
        )}
      </View>
    </View>
  );

  const renderGoals = () => (
    <View style={styles.stepContent}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
          <Ionicons name="flag" size={32} color="#F59E0B" />
        </View>
        <AppText weight="heading" size={24} style={{ marginTop: 16, textAlign: 'center' }}>
          Set Your Goals
        </AppText>
        <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center' }}>
          Personalize your health targets
        </AppText>
      </Animated.View>

      <View style={styles.goalsList}>
        <GoalSlider 
          icon="footsteps" 
          color="#10B981" 
          title="Daily Steps" 
          value={goals.steps} 
          min={5000} 
          max={20000} 
          step={1000}
          unit="steps"
          onChange={(v) => setGoals(g => ({ ...g, steps: v }))} 
        />
        <GoalSlider 
          icon="moon" 
          color="#8B5CF6" 
          title="Sleep Goal" 
          value={goals.sleep} 
          min={5} 
          max={10} 
          step={0.5}
          unit="hours"
          onChange={(v) => setGoals(g => ({ ...g, sleep: v }))} 
        />
        <GoalSlider 
          icon="water" 
          color="#3B82F6" 
          title="Water Intake" 
          value={goals.water} 
          min={4} 
          max={12} 
          step={1}
          unit="glasses"
          onChange={(v) => setGoals(g => ({ ...g, water: v }))} 
        />
      </View>

      <View style={styles.bottomAction}>
        <PrimaryButton title="Continue" onPress={nextStep} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} />
        <Pressable onPress={nextStep} style={{ marginTop: 16 }}>
          <AppText size={13} color={theme.colors.textMute}>Use defaults</AppText>
        </Pressable>
      </View>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeInDown.duration(600)}>
        <View style={styles.completeIcon}>
          <LinearGradient colors={['#2DD4BF', '#10B981']} style={styles.completeGradient}>
            <Ionicons name="checkmark" size={64} color="#fff" />
          </LinearGradient>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <AppText weight="heading" size={28} style={{ marginTop: 24, textAlign: 'center' }}>
          You're All Set!
        </AppText>
        <AppText size={15} color={theme.colors.textDim} style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          Your health journey begins now. We'll sync your data in the background.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.completeSummary}>
        <GlassCard style={{ padding: 20 }}>
          <AppText size={11} color={theme.colors.textDim} weight="med" style={{ letterSpacing: 1.5, marginBottom: 12 }}>SETUP SUMMARY</AppText>
          {selectedDevice && (
            <View style={styles.summaryRow}>
              <Ionicons name="watch-outline" size={18} color={theme.colors.teal} />
              <AppText size={14} style={{ marginLeft: 10 }}>{selectedDevice.name} connected</AppText>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Ionicons name="flag-outline" size={18} color="#F59E0B" />
            <AppText size={14} style={{ marginLeft: 10 }}>{goals.steps.toLocaleString()} steps daily goal</AppText>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name={historyOption === 'import' ? 'cloud-done-outline' : 'refresh-outline'} size={18} color="#8B5CF6" />
            <AppText size={14} style={{ marginLeft: 10 }}>{historyOption === 'import' ? 'History imported' : 'Starting fresh'}</AppText>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.bottomAction}>
        <PrimaryButton title="Go to Dashboard" onPress={completeOnboarding} icon={<Ionicons name="home" size={18} color="#fff" />} />
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Progress bar */}
        {currentStep !== 'welcome' && currentStep !== 'complete' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <AppText size={11} color={theme.colors.textMute} style={{ marginTop: 8 }}>
              Step {stepIndex + 1} of {STEPS.length}
            </AppText>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {currentStep === 'welcome' && renderWelcome()}
          {currentStep === 'permissions' && renderPermissions()}
          {currentStep === 'bluetooth' && renderBluetooth()}
          {currentStep === 'pairing' && renderPairing()}
          {currentStep === 'history' && renderHistory()}
          {currentStep === 'goals' && renderGoals()}
          {currentStep === 'complete' && renderComplete()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function GoalSlider({ icon, color, title, value, min, max, step, unit, onChange }: any) {
  return (
    <Animated.View entering={FadeInRight.duration(400)}>
      <GlassCard style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIcon, { backgroundColor: `${color}22` }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <AppText weight="semi" size={15} style={{ marginLeft: 12 }}>{title}</AppText>
        </View>
        <View style={styles.goalValue}>
          <AppText weight="heading" size={36} color={color}>{value.toLocaleString()}</AppText>
          <AppText size={14} color={theme.colors.textMute} style={{ marginLeft: 8 }}>{unit}</AppText>
        </View>
        <View style={styles.goalButtons}>
          <Pressable 
            style={styles.goalBtn} 
            onPress={() => onChange(Math.max(min, value - step))}
          >
            <Ionicons name="remove" size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${((value - min) / (max - min)) * 100}%`, backgroundColor: color }]} />
          </View>
          <Pressable 
            style={styles.goalBtn} 
            onPress={() => onChange(Math.min(max, value + step))}
          >
            <Ionicons name="add" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1, padding: theme.space.lg },
  progressContainer: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.teal, borderRadius: 2 },
  
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  stepContent: { flex: 1, paddingTop: 20 },
  stepHeader: { alignItems: 'center', marginBottom: 24 },
  stepIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  
  logoContainer: { marginBottom: 8 },
  logoGradient: { width: 100, height: 100, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { marginTop: 16, textAlign: 'center', letterSpacing: -1 },
  welcomeSubtitle: { marginTop: 8, textAlign: 'center', lineHeight: 24 },
  featureList: { marginTop: 40, width: '100%' },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(45,212,191,0.15)', alignItems: 'center', justifyContent: 'center' },
  
  bottomAction: { marginTop: 'auto', paddingTop: 24, alignItems: 'center' },
  
  permissionsList: { gap: 12 },
  permissionCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  permIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  
  bluetoothCard: { alignItems: 'center', padding: 32 },
  bluetoothVisual: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  bluetoothRing: { position: 'absolute', width: 80, height: 80, borderRadius: 100, borderWidth: 2, borderColor: theme.colors.teal, opacity: 0.8 },
  bluetoothCenter: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(45,212,191,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  scanContainer: { alignItems: 'center', marginVertical: 24 },
  scanPulse: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(45,212,191,0.15)' },
  scanButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(45,212,191,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(45,212,191,0.3)' },
  scanButtonActive: { backgroundColor: 'rgba(45,212,191,0.25)' },
  deviceList: { maxHeight: 280 },
  deviceCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10 },
  deviceCardPairing: { borderColor: theme.colors.teal, borderWidth: 2 },
  deviceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  signalDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.emerald, marginHorizontal: 8 },
  pairingIndicator: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(45,212,191,0.15)', borderRadius: 12 },
  pairedSuccess: { alignItems: 'center', marginTop: 24 },
  successIcon: { marginBottom: 24 },
  successGradient: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  pairedCard: { flexDirection: 'row', alignItems: 'center', padding: 16, width: '100%' },
  
  historyOptions: { gap: 16 },
  historyCard: { padding: 24, alignItems: 'center' },
  historyCardSelected: { borderColor: theme.colors.teal, borderWidth: 2 },
  historyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 },
  selectedCheck: { position: 'absolute', top: 12, right: 12 },
  importProgress: { marginTop: 24 },
  importCard: { alignItems: 'center', padding: 32 },
  importVisual: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  importCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: theme.colors.teal, alignItems: 'center', justifyContent: 'center' },
  importBar: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  importBarFill: { height: '100%', backgroundColor: theme.colors.teal, borderRadius: 3 },
  
  goalsList: { gap: 16 },
  goalCard: { padding: 20 },
  goalHeader: { flexDirection: 'row', alignItems: 'center' },
  goalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalValue: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  goalButtons: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  goalBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  goalTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 3 },
  
  completeIcon: { marginBottom: 8 },
  completeGradient: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  completeSummary: { marginTop: 32, width: '100%' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
