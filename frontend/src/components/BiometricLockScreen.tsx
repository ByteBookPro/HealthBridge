import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, AppState, AppStateStatus, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import AuroraBackground from './AuroraBackground';
import BiometricAuth from '@/src/services/biometricAuth';

interface BiometricLockScreenProps {
  onUnlock: () => void;
  onSkip?: () => void;
}

export default function BiometricLockScreen({ onUnlock, onSkip }: BiometricLockScreenProps) {
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [biometricIcon, setBiometricIcon] = useState<keyof typeof Ionicons.glyphMap>('finger-print');
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  
  // Pulse animation
  const scale = useSharedValue(1);
  
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);
  
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    // Get biometric type
    const checkBiometric = async () => {
      const status = await BiometricAuth.checkAvailability();
      setBiometricType(status.typeName);
      
      // Set appropriate icon
      if (status.type === 'facial') {
        setBiometricIcon(Platform.OS === 'ios' ? 'scan-outline' : 'happy-outline');
      } else if (status.type === 'fingerprint') {
        setBiometricIcon('finger-print');
      } else {
        setBiometricIcon('eye-outline');
      }
      
      // Auto-trigger authentication on mount
      handleAuthenticate();
    };
    
    checkBiometric();
  }, []);

  // Handle app state changes - re-trigger auth when coming to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        handleAuthenticate();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const handleAuthenticate = async () => {
    if (authenticating) return;
    
    setAuthenticating(true);
    setError(null);
    
    const result = await BiometricAuth.authenticate('Unlock HealthBridge');
    
    if (result.success) {
      onUnlock();
    } else if (result.error && result.error !== 'Authentication cancelled') {
      setError(result.error);
    }
    
    setAuthenticating(false);
  };

  return (
    <View style={styles.container}>
      <AuroraBackground />
      
      {/* Logo and title */}
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['rgba(45,212,191,0.3)', 'rgba(16,185,129,0.15)']}
            style={styles.logoGlow}
          />
          <Ionicons name="shield-checkmark" size={36} color={theme.colors.teal} />
        </View>
        <AppText weight="heading" size={28} style={styles.title}>
          HealthBridge
        </AppText>
        <AppText size={13} color={theme.colors.textDim} style={styles.subtitle}>
          Your health data is protected
        </AppText>
      </Animated.View>

      {/* Biometric prompt */}
      <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.center}>
        <Pressable onPress={handleAuthenticate} disabled={authenticating}>
          <Animated.View style={[styles.biometricButton, pulseStyle]}>
            <LinearGradient
              colors={['rgba(45,212,191,0.2)', 'rgba(45,212,191,0.05)']}
              style={styles.biometricGradient}
            >
              <View style={styles.biometricInner}>
                <Ionicons 
                  name={biometricIcon} 
                  size={56} 
                  color={authenticating ? theme.colors.textMute : theme.colors.teal} 
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </Pressable>
        
        <AppText weight="semi" size={16} style={styles.promptText}>
          {authenticating ? 'Authenticating...' : `Tap to use ${biometricType}`}
        </AppText>
        
        {error && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
            <AppText size={12} color={theme.colors.danger} style={{ marginLeft: 6 }}>
              {error}
            </AppText>
          </Animated.View>
        )}
      </Animated.View>

      {/* Security info */}
      <View style={styles.footer}>
        <View style={styles.securityBadge}>
          <Ionicons name="lock-closed" size={12} color={theme.colors.emerald} />
          <AppText size={10} color={theme.colors.textDim} style={{ marginLeft: 4 }}>
            End-to-end encrypted
          </AppText>
        </View>
        
        {onSkip && (
          <Pressable onPress={onSkip} style={styles.skipLink}>
            <AppText size={12} color={theme.colors.textMute}>
              Skip for now
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    alignItems: 'center',
    marginTop: 100,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,212,191,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.3)',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.5,
  },
  title: {
    marginTop: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  biometricButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  biometricGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(45,212,191,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptText: {
    marginTop: 24,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 999,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 999,
  },
  skipLink: {
    marginTop: 16,
    padding: 8,
  },
});
