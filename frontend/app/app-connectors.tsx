import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';
import SyncingOverlay from '@/src/components/SyncingOverlay';
import { api, type ConnectorOut } from '@/src/api/client';

type AppConnector = ConnectorOut & {
  description: string;
  setupSteps: string[];
  appStoreUrl?: string;
  playStoreUrl?: string;
  limitations?: string;
};

// Static metadata layered on top of the live backend connector list
const CONNECTOR_META: Record<string, {
  description: string;
  setupSteps: string[];
  appStoreUrl?: string;
  playStoreUrl?: string;
  limitations?: string;
}> = {
  apple_health: {
    description: 'Sync all health data from Apple Health including data from connected apps like MyFitnessPal, Strava, etc.',
    setupSteps: [
      'Tap "Connect" below',
      'Allow HealthBridge to read your health data',
      'Select which categories to share',
      'Data will sync automatically in background',
    ],
    limitations: 'Only available on iOS devices',
  },
  google_fit: {
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
  samsung_health: {
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
  fitbit: {
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
  garmin: {
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
  myfitnesspal: {
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
  strava: {
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
  oura: {
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
  withings: {
    description: 'Sync body composition and blood pressure data from Withings devices.',
    setupSteps: [
      'Install Withings Health Mate app',
      'Connect to Apple Health or Google Fit',
      'HealthBridge will import body metrics automatically',
    ],
    appStoreUrl: 'https://apps.apple.com/app/withings-health-mate/id542701020',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.withings.wiscale2',
  },
};

export default function AppConnectorsScreen() {
  const router = useRouter();
  const [connectors, setConnectors] = useState<AppConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPlatform = Platform.OS as 'ios' | 'android' | 'web';

  const load = useCallback(async () => {
    try {
      const data = await api.connectors();
      setConnectors(data.map((c) => ({
        ...c,
        description: CONNECTOR_META[c.connector_id]?.description || '',
        setupSteps: CONNECTOR_META[c.connector_id]?.setupSteps || [],
        appStoreUrl: CONNECTOR_META[c.connector_id]?.appStoreUrl,
        playStoreUrl: CONNECTOR_META[c.connector_id]?.playStoreUrl,
        limitations: CONNECTOR_META[c.connector_id]?.limitations,
      })));
    } catch (e) {
      console.warn('Failed to load connectors:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async (connector: AppConnector) => {
    const available = connector.platforms.includes(currentPlatform) || currentPlatform === 'web';
    if (!available) {
      Alert.alert(
        'Not Available',
        connector.limitations || `${connector.name} is not available on this platform.`,
        [{ text: 'OK' }],
      );
      return;
    }
    setBusyId(connector.connector_id);
    try {
      if (connector.connected) {
        const updated = await api.disconnectConnector(connector.connector_id);
        setConnectors((prev) => prev.map((c) =>
          c.connector_id === connector.connector_id ? { ...c, ...updated } : c
        ));
      } else {
        // Show syncing animation while the connector initializes
        setSyncing(true);
        const [updated] = await Promise.all([
          api.connectConnector(connector.connector_id),
          // Trigger an initial sync so the dashboard immediately reflects data
          api.syncNow().catch(() => null),
          new Promise((res) => setTimeout(res, 1400)),
        ]);
        setConnectors((prev) => prev.map((c) =>
          c.connector_id === connector.connector_id ? { ...c, ...updated } : c
        ));
        setSyncing(false);
      }
    } catch (e: any) {
      Alert.alert('Connection failed', e?.message || 'Could not update connector. Try again.');
    } finally {
      setBusyId(null);
      setSyncing(false);
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

  const totalConnected = connectors.filter((c) => c.connected).length;
  // Connectors that are NOT yet connected and ARE compatible with the
  // current platform (or 'web' which sees all of them) — these are the ones
  // the bulk-connect button will attempt.
  const bulkTargets = connectors.filter((c) =>
    !c.connected && (c.platforms.includes(currentPlatform) || currentPlatform === 'web')
  );

  const handleBulkConnect = async () => {
    if (bulkTargets.length === 0) return;
    setSyncing(true);
    try {
      const platforms = currentPlatform === 'web' ? undefined : [currentPlatform];
      const [updated] = await Promise.all([
        api.bulkConnect(platforms),
        api.syncNow().catch(() => null),
        new Promise((res) => setTimeout(res, 1400)),
      ]);
      setConnectors(updated.map((c) => ({
        ...c,
        description: CONNECTOR_META[c.connector_id]?.description || '',
        setupSteps: CONNECTOR_META[c.connector_id]?.setupSteps || [],
        appStoreUrl: CONNECTOR_META[c.connector_id]?.appStoreUrl,
        playStoreUrl: CONNECTOR_META[c.connector_id]?.playStoreUrl,
        limitations: CONNECTOR_META[c.connector_id]?.limitations,
      })));
    } catch (e: any) {
      Alert.alert('Bulk connect failed', e?.message || 'Try connecting individually.');
    } finally {
      setSyncing(false);
    }
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
          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="small" color={theme.colors.teal} />
            </View>
          )}

          {/* Stats banner */}
          {!loading && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <GlassCard style={styles.infoCard} testID="connectors-summary">
                <View style={styles.infoRow}>
                  <View style={[styles.summaryDot, { backgroundColor: totalConnected > 0 ? theme.colors.emerald : theme.colors.textMute }]} />
                  <AppText size={12} color={theme.colors.textDim} style={{ flex: 1, marginLeft: 10 }}>
                    {totalConnected === 0
                      ? 'No data sources connected — metrics on your dashboard stay locked until at least one app starts syncing.'
                      : `${totalConnected} ${totalConnected === 1 ? 'source' : 'sources'} connected — metrics unlock automatically as data flows in.`}
                  </AppText>
                </View>
                {bulkTargets.length > 0 && (
                  <Pressable
                    onPress={handleBulkConnect}
                    style={styles.bulkBtn}
                    disabled={syncing}
                    testID="bulk-connect-btn"
                  >
                    <Ionicons name="flash" size={14} color={theme.colors.teal} />
                    <AppText size={12} weight="semi" color={theme.colors.teal} style={{ marginLeft: 8 }}>
                      Connect all {bulkTargets.length} available {bulkTargets.length === 1 ? 'app' : 'apps'}
                    </AppText>
                  </Pressable>
                )}
              </GlassCard>
            </Animated.View>
          )}

          {/* Primary Connectors */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            PRIMARY HEALTH PLATFORMS
          </AppText>
          {connectors.filter(c => ['apple_health', 'google_fit', 'samsung_health'].includes(c.connector_id)).map((connector, idx) => (
            <Animated.View key={connector.connector_id} entering={FadeInDown.delay(idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.connector_id}
                available={isAvailable(connector)}
                busy={busyId === connector.connector_id}
                onToggle={() => toggleExpanded(connector.connector_id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          {/* Fitness Trackers */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            FITNESS TRACKERS & WEARABLES
          </AppText>
          {connectors.filter(c => ['fitbit', 'garmin', 'oura', 'withings'].includes(c.connector_id)).map((connector, idx) => (
            <Animated.View key={connector.connector_id} entering={FadeInDown.delay(180 + idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.connector_id}
                available={isAvailable(connector)}
                busy={busyId === connector.connector_id}
                onToggle={() => toggleExpanded(connector.connector_id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          {/* Nutrition & Exercise Apps */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            NUTRITION & EXERCISE APPS
          </AppText>
          {connectors.filter(c => ['myfitnesspal', 'strava'].includes(c.connector_id)).map((connector, idx) => (
            <Animated.View key={connector.connector_id} entering={FadeInDown.delay(420 + idx * 60).duration(400)}>
              <ConnectorCard
                connector={connector}
                expanded={expandedId === connector.connector_id}
                available={isAvailable(connector)}
                busy={busyId === connector.connector_id}
                onToggle={() => toggleExpanded(connector.connector_id)}
                onConnect={() => handleConnect(connector)}
                onOpenStore={() => openStore(connector)}
              />
            </Animated.View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
      <SyncingOverlay
        visible={syncing}
        label="Connecting & importing data"
        subtitle="Pulling your initial metrics into the HealthBridge vault…"
      />
    </View>
  );
}

function ConnectorCard({
  connector,
  expanded,
  available,
  busy,
  onToggle,
  onConnect,
  onOpenStore,
}: {
  connector: AppConnector;
  expanded: boolean;
  available: boolean;
  busy: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onOpenStore: () => void;
}) {
  return (
    <GlassCard style={[styles.connectorCard, !available && styles.unavailable]} testID={`connector-${connector.connector_id}`}>
      <Pressable onPress={onToggle} style={styles.connectorHeader}>
        <View style={[styles.connectorIcon, { backgroundColor: `${connector.color}18`, borderColor: `${connector.color}40` }]}>
          <Ionicons name={connector.icon as any} size={22} color={connector.color} />
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
            {connector.metrics_provided.length} metrics available
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
            METRICS PROVIDED:
          </AppText>
          <View style={styles.metricsChips}>
            {connector.metrics_provided.slice(0, 6).map(m => (
              <View key={m} style={styles.metricChip}>
                <AppText size={9} color={theme.colors.teal}>
                  {m.replace(/_/g, ' ')}
                </AppText>
              </View>
            ))}
            {connector.metrics_provided.length > 6 && (
              <View style={styles.metricChip}>
                <AppText size={9} color={theme.colors.textMute}>
                  +{connector.metrics_provided.length - 6} more
                </AppText>
              </View>
            )}
          </View>

          {/* Setup Steps */}
          {connector.setupSteps.length > 0 && (
            <>
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
            </>
          )}

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
              <Pressable onPress={onOpenStore} style={styles.secondaryBtn} testID={`connector-store-${connector.connector_id}`}>
                <Ionicons name="download-outline" size={14} color={theme.colors.textDim} />
                <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                  Get App
                </AppText>
              </Pressable>
            )}
            <Pressable
              onPress={onConnect}
              disabled={busy}
              style={[styles.connectBtn, connector.connected && styles.disconnectBtn, busy && { opacity: 0.6 }]}
              testID={`connector-action-${connector.connector_id}`}
            >
              {busy ? (
                <ActivityIndicator size="small" color={connector.connected ? theme.colors.danger : '#fff'} />
              ) : (
                <>
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
                </>
              )}
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
  summaryDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 4,
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
