import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

const BIOMETRIC_ENABLED_KEY = '@healthbridge_biometric_enabled';
const LAST_AUTH_KEY = '@healthbridge_last_auth';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before requiring re-auth

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  type: BiometricType;
  typeName: string;
}

/**
 * Biometric authentication service for HealthBridge
 * Handles Face ID, Touch ID, and Android biometrics
 */
export const BiometricAuth = {
  /**
   * Check if biometric authentication is available on this device
   */
  async checkAvailability(): Promise<BiometricStatus> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      let type: BiometricType = 'none';
      let typeName = 'Not Available';
      
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        type = 'facial';
        typeName = Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        type = 'fingerprint';
        typeName = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        type = 'iris';
        typeName = 'Iris Scan';
      }
      
      return {
        available: hasHardware,
        enrolled: isEnrolled,
        type,
        typeName,
      };
    } catch (error) {
      console.warn('Biometric check failed:', error);
      return { available: false, enrolled: false, type: 'none', typeName: 'Not Available' };
    }
  },

  /**
   * Check if biometric authentication is enabled by the user
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Enable or disable biometric authentication
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
      if (!enabled) {
        await AsyncStorage.removeItem(LAST_AUTH_KEY);
      }
    } catch (error) {
      console.warn('Failed to save biometric setting:', error);
    }
  },

  /**
   * Check if recent authentication is still valid (within timeout)
   */
  async hasRecentAuth(): Promise<boolean> {
    try {
      const lastAuth = await AsyncStorage.getItem(LAST_AUTH_KEY);
      if (!lastAuth) return false;
      
      const lastAuthTime = parseInt(lastAuth, 10);
      const now = Date.now();
      return (now - lastAuthTime) < AUTH_TIMEOUT_MS;
    } catch {
      return false;
    }
  },

  /**
   * Record successful authentication timestamp
   */
  async recordAuth(): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_AUTH_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Failed to record auth time:', error);
    }
  },

  /**
   * Authenticate the user with biometrics
   */
  async authenticate(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.checkAvailability();
      
      if (!status.available) {
        return { success: false, error: 'Biometric hardware not available' };
      }
      
      if (!status.enrolled) {
        return { success: false, error: 'No biometrics enrolled on device' };
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Unlock HealthBridge',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        await this.recordAuth();
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result.error === 'user_cancel' ? 'Authentication cancelled' : 'Authentication failed'
      };
    } catch (error) {
      console.warn('Biometric auth error:', error);
      return { success: false, error: 'Authentication error occurred' };
    }
  },

  /**
   * Check if authentication is required (enabled + not recently authenticated)
   */
  async requiresAuth(): Promise<boolean> {
    const isEnabled = await this.isEnabled();
    if (!isEnabled) return false;
    
    const hasRecent = await this.hasRecentAuth();
    return !hasRecent;
  },

  /**
   * Authenticate for sensitive actions with custom prompt
   */
  async authenticateSensitive(action: string): Promise<boolean> {
    const result = await this.authenticate(`Authenticate to ${action}`);
    return result.success;
  },

  /**
   * Get user-friendly name for the biometric type
   */
  async getBiometricName(): Promise<string> {
    const status = await this.checkAvailability();
    return status.typeName;
  },
};

export default BiometricAuth;
