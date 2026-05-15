import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';

type AppConnector = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  platforms: ('ios' | 'android' | 'web')[];
  connected: boolean;
  metricsEnabled: string[];
  description: string;
  setupSteps: string[];
  appStoreUrl?: string;
  playStoreUrl?: string;
  limitations?: string;
};

const APP_CONNECTORS: AppConnector[] = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: 'logo-apple',
    color: '#F3F4F6',
    platforms: ['ios'],
    connected: false,
    metricsEnabled: ['steps', 'heart_rate', 'sleep', 'calories', 'workouts', 'vo2_max', 'hrv', 'spo2', 'ecg'],
    description: 'Sync all health data from Apple Health including data from connected apps like MyFitnessPal, Strava, etc.',
    setupSteps: [
      'Tap "Connect" below',
      'Allow HealthBridge to read your health data',
      'Select which categories to share',
      'Data will sync automatically in background',
    ],
    limitations: 'Only available on iOS devices',
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: 'logo-google',
    color: '#EA4335',
    platforms: ['android'],
    connected: false,
    metricsEnabled: ['steps', 'heart_rate', 'sleep', 'calories', 'distance', 'active_minutes'],
    description: 'Connect with Google Fit to sync fitness and health data from your Android device and connected apps.',
    setupSteps: [
      'Install Google Fit app if not installed',
      'Tap "Connect" below',
      'Sign in with your Google account',
      'Grant permissions for health data access',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.fitness',
    limitations: 'Only available on Android devices',
  },
  {
    id: 'samsung_health',
    name: 'Samsung Health',
    icon: 'phone-portrait-outline',
    color: '#3B82F6',
    platforms: ['android'],
    connected: false,
    metricsEnabled: ['steps', 'heart_rate', 'sleep', 'calories', 'stress', 'blood_pressure_sys', 'blood_pressure_dia', 'spo2'],
    description: 'Sync data from Samsung Health including Galaxy Watch metrics and body composition data.',
    setupSteps: [
      'Open Samsung Health app',
      'Go to Settings > Connected Services',
      'Enable "Health Connect" integration',
      'Return here and tap "Connect"',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.sec.android.app.shealth',
    limitations: 'Requires Samsung Health app and Health Connect on Android',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: 'fitness-outline',
    color: '#00B0B9',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['steps', 'heart_rate', 'sleep', 'calories', 'active_minutes', 'floors', 'distance'],
    description: 'Connect your Fitbit account to sync data from Fitbit trackers and smartwatches.',
    setupSteps: [
      'Ensure Fitbit app is installed and signed in',
      'Tap "Connect" below',
      'Authorize HealthBridge in the Fitbit app',
      'Select data types to share',
    ],
    appStoreUrl: 'https://apps.apple.com/app/fitbit-health-fitness/id462638897',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fitbit.FitbitMobile',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: 'navigate-outline',
    color: '#007DC3',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['steps', 'heart_rate', 'sleep', 'calories', 'vo2_max', 'training_load', 'recovery_time', 'stress'],
    description: 'Sync data from Garmin devices including advanced training metrics and body battery.',
    setupSteps: [
      'Install Garmin Connect app',
      'Sign in to your Garmin account',
      'Tap "Connect" below',
      'Authorize HealthBridge to access your data',
    ],
    appStoreUrl: 'https://apps.apple.com/app/garmin-connect/id583446403',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.garmin.android.apps.connectmobile',
  },
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    icon: 'restaurant-outline',
    color: '#0073CF',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['calorie_intake', 'protein', 'carbs', 'fat', 'fiber', 'water'],
    description: 'Sync nutrition data including calorie intake and macronutrients from MyFitnessPal.',
    setupSteps: [
      'Install MyFitnessPal app',
      'Connect MyFitnessPal to Apple Health or Google Fit',
      'HealthBridge will automatically import nutrition data',
    ],
    appStoreUrl: 'https://apps.apple.com/app/myfitnesspal-calorie-counter/id341232718',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.myfitnesspal.android',
    limitations: 'Syncs via Apple Health/Google Fit integration',
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: 'bicycle-outline',
    color: '#FC4C02',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['workouts', 'distance', 'calories', 'heart_rate', 'vo2_max'],
    description: 'Import workout data from Strava including runs, rides, and other activities.',
    setupSteps: [
      'Install Strava app',
      'Connect Strava to Apple Health or Google Fit',
      'HealthBridge will import your workout data automatically',
    ],
    appStoreUrl: 'https://apps.apple.com/app/strava-run-ride-swim/id426826309',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.strava',
    limitations: 'Syncs via Apple Health/Google Fit integration',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: 'ellipse-outline',
    color: '#D4AF37',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['sleep', 'sleep_quality', 'hrv', 'resting_hr', 'body_temp', 'respiratory_rate'],
    description: 'Sync detailed sleep and recovery data from your Oura Ring.',
    setupSteps: [
      'Install Oura app',
      'Connect Oura to Apple Health or Google Fit',
      'HealthBridge will import sleep and readiness data',
    ],
    appStoreUrl: 'https://apps.apple.com/app/oura/id1043837948',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ouraring.oura',
    limitations: 'Syncs via Apple Health/Google Fit integration',
  },
  {
    id: 'withings',
    name: 'Withings Health Mate',
    icon: 'scale-outline',
    color: '#00A0E0',
    platforms: ['ios', 'android'],
    connected: false,
    metricsEnabled: ['weight', 'bmi', 'body_fat', 'muscle_mass', 'blood_pressure_sys', 'blood_pressure_dia'],
    description: 'Sync body composition and blood pressure data from Withings devices.',
    setupSteps: [
      'Install Withings Health Mate app',
      'Connect to Apple Health or Google Fit',
      'HealthBridge will import body metrics automatically',
    ],
    appStoreUrl: 'https://apps.apple.com/app/withings-health-mate/id542701020',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.withings.wiscale2',
  },
];

export default function AppConnectorsScreen() {
  const router = useRouter();
  const [connectors, setConnectors] = useState(APP_CONNECTORS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPlatform = Platform.OS as 'ios' | 'android' | 'web';

  const handleConnect = async (connector: AppConnector) => {
    if (!connector.platforms.includes(currentPlatform) && currentPlatform !== 'web') {
      Alert.alert(
        'Not Available',
        connector.limitations || `${connector.name} is not available on this platform.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // For demo purposes, toggle connection status
    setConnectors(prev =>
      prev.map(c =>
        c.id === connector.id ? { ...c, connected: !c.connected } : c
      )
    );

    if (!connector.connected) {
      Alert.alert(
        'Connected!',
        `${connector.name} has been connected. ${connector.metricsEnabled.length} metrics will now sync automatically.`,
        [{ text: 'Great!' }]
      );
    }
  };

  const openStore = (connector: AppConnector) => {
    const url = currentPlatform === 'ios' ? connector.appStoreUrl : connector.playStoreUrl;
    if (url) {
      Linking.openURL(url);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const isAvailable = (connector: AppConnector) => {
    return connector.platforms.includes(currentPlatform) || currentPlatform === 'web';
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <AppText weight="heading" size={22}>App Connectors</AppText>
            <AppText size={12} color={theme.colors.textDim}>Connect apps to enable more metrics</AppText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="information-circle" size={20} color={theme.colors.teal} />
                <AppText size={12} color={theme.colors.textDim} style={{ flex: 1, marginLeft: 10 }}>
                  Connect your health apps to unlock more metrics. Data syncs automatically through Apple Health (iOS) or Health Connect (Android).
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Primary Connectors */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            PRIMARY HEALTH PLATFORMS
          </AppText>
          {connectors.filter(c => ['apple_health', 'google_fit', 'samsung_health'].includes(c.id)).map((connector, idx) => (
            <Animated.View key={connector.id} entering={FadeInDown.delay(idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.id}
                available={isAvailable(connector)}
                onToggle={() => toggleExpanded(connector.id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          {/* Fitness Trackers */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            FITNESS TRACKERS & WEARABLES
          </AppText>
          {connectors.filter(c => ['fitbit', 'garmin', 'oura', 'withings'].includes(c.id)).map((connector, idx) => (
            <Animated.View key={connector.id} entering={FadeInDown.delay(180 + idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.id}
                available={isAvailable(connector)}
                onToggle={() => toggleExpanded(connector.id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          {/* Nutrition & Exercise Apps */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            NUTRITION & EXERCISE APPS
          </AppText>
          {connectors.filter(c => ['myfitnesspal', 'strava'].includes(c.id)).map((connector, idx) => (
            <Animated.View key={connector.id} entering={FadeInDown.delay(420 + idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.id}
                available={isAvailable(connector)}
                onToggle={() => toggleExpanded(connector.id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ConnectorCard({
  connector,
  expanded,
  available,
  onToggle,
  onConnect,
  onOpenStore,
}: {
  connector: AppConnector;
  expanded: boolean;
  available: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onOpenStore: () => void;
}) {
  return (
    <GlassCard style={[styles.connectorCard, !available && styles.unavailable]}>
      <Pressable onPress={onToggle} style={styles.connectorHeader}>
        <View style={[styles.connectorIcon, { backgroundColor: `${connector.color}18`, borderColor: `${connector.color}40` }]}>
          <Ionicons name={connector.icon} size={22} color={connector.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText weight="semi" size={15}>{connector.name}</AppText>
            {connector.connected && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={theme.colors.emerald} />
                <AppText size={9} weight="semi" color={theme.colors.emerald} style={{ marginLeft: 3 }}>
                  Connected
                </AppText>
              </View>
            )}
          </View>
          <AppText size={11} color={theme.colors.textDim} style={{ marginTop: 2 }}>
            {connector.metricsEnabled.length} metrics available
          </AppText>
        </View>
        {!available && (
          <View style={styles.unavailableBadge}>
            <AppText size={9} color={theme.colors.textMute}>Not Available</AppText>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMute}
        />
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          <AppText size={12} color={theme.colors.textDim} style={{ marginBottom: 12 }}>
            {connector.description}
          </AppText>

          {/* Enabled Metrics */}
          <AppText size={10} color={theme.colors.textMute} weight="med" style={{ marginBottom: 6 }}>
            METRICS ENABLED:
          </AppText>
          <View style={styles.metricsChips}>
            {connector.metricsEnabled.slice(0, 6).map(m => (
              <View key={m} style={styles.metricChip}>
                <AppText size={9} color={theme.colors.teal}>
                  {m.replace(/_/g, ' ')}
                </AppText>
              </View>
            ))}
            {connector.metricsEnabled.length > 6 && (
              <View style={styles.metricChip}>
                <AppText size={9} color={theme.colors.textMute}>
                  +{connector.metricsEnabled.length - 6} more
                </AppText>
              </View>
            )}
          </View>

          {/* Setup Steps */}
          <AppText size={10} color={theme.colors.textMute} weight="med" style={{ marginTop: 12, marginBottom: 8 }}>
            HOW TO CONNECT:
          </AppText>
          {connector.setupSteps.map((step, i) => (
            <View key={i} style={styles.setupStep}>
              <View style={styles.stepNumber}>
                <AppText size={10} weight="semi" color={theme.colors.teal}>{i + 1}</AppText>
              </View>
              <AppText size={11} color={theme.colors.textDim} style={{ flex: 1 }}>
                {step}
              </AppText>
            </View>
          ))}

          {/* Limitations Warning */}
          {connector.limitations && !available && (
            <View style={styles.limitationBox}>
              <Ionicons name="warning" size={14} color={theme.colors.warning} />
              <AppText size={11} color={theme.colors.warning} style={{ flex: 1, marginLeft: 8 }}>
                {connector.limitations}
              </AppText>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {(connector.appStoreUrl || connector.playStoreUrl) && (
              <Pressable onPress={onOpenStore} style={styles.secondaryBtn}>
                <Ionicons name="download-outline" size={14} color={theme.colors.textDim} />
                <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                  Get App
                </AppText>
              </Pressable>
            )}
            <Pressable
              onPress={onConnect}
              style={[styles.connectBtn, connector.connected && styles.disconnectBtn]}
            >
              <Ionicons
                name={connector.connected ? 'close-circle' : 'link'}
                size={14}
                color={connector.connected ? theme.colors.danger : '#fff'}
              />
              <AppText
                size={11}
                weight="semi"
                color={connector.connected ? theme.colors.danger : '#fff'}
                style={{ marginLeft: 6 }}
              >
                {connector.connected ? 'Disconnect' : 'Connect'}
              </AppText>
            </Pressable>
          </View>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: theme.space.lg,
  },
  infoCard: {
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    letterSpacing: 1.5,
    marginTop: theme.space.md,
    marginBottom: theme.space.sm,
  },
  connectorCard: {
    marginBottom: 10,
    overflow: 'hidden',
  },
  unavailable: {
    opacity: 0.6,
  },
  connectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space.md,
  },
  connectorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  unavailableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  expandedContent: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: -4,
    paddingTop: theme.space.md,
  },
  metricsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.3)',
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(45,212,191,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  limitationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    marginTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  connectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.teal,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
});
