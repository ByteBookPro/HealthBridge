import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { ThemeProvider, useTheme, defaultTheme } from '@/src/context/ThemeContext';
import { theme as legacyTheme } from '@/src/theme/theme';
import { registerForPushAsync } from '@/src/services/pushNotifications';

function PushRegistrar() {
  const { isAuthed } = useAuth();
  useEffect(() => {
    if (isAuthed) {
      // Wrap in try/catch — expo-notifications was removed from Expo Go SDK 53+
      try { registerForPushAsync().catch(() => {}); } catch {}
    }
  }, [isAuthed]);
  return null;
}

function ThemedStack() {
  const { theme, isDark } = useTheme();
  
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'fade',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold,
  });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: defaultTheme.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={defaultTheme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PushRegistrar />
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
