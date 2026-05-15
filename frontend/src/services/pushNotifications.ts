import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/src/api/client';

// expo-notifications was removed from Expo Go SDK 53+; load defensively so
// the app keeps running and the dev/EAS build still gets real push.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch {
  Notifications = null;
}

export async function registerForPushAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HealthBridge',
        importance: Notifications.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2DD4BF',
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api.registerPush(token.data, Platform.OS as 'ios' | 'android', Constants.expoConfig?.version ?? '1.0.0');
    return token.data;
  } catch {
    return null;
  }
}
