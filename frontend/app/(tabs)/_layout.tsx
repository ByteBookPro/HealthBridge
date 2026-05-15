import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme/theme';

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'pulse',
  watches: 'watch',
  sync: 'sync',
  vault: 'shield-checkmark',
  settings: 'settings',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.teal,
        tabBarInactiveTintColor: theme.colors.textMute,
        tabBarLabelStyle: { fontFamily: theme.font.bodyMed, fontSize: 10, marginTop: -2 },
        tabBarStyle: {
          position: 'absolute',
          left: 16, right: 16, bottom: Platform.OS === 'ios' ? 24 : 16,
          height: 64, paddingTop: 8, paddingBottom: 8,
          borderRadius: 24,
          borderTopWidth: 0,
          borderWidth: 1, borderColor: theme.colors.border,
          backgroundColor: Platform.OS === 'web' ? 'rgba(12,12,16,0.85)' : 'transparent',
          overflow: 'hidden',
        },
        tabBarBackground: () =>
          Platform.OS !== 'web' ? (
            <BlurView intensity={50} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]} />
          ) : null,
        tabBarIcon: ({ color, focused }) => (
          <View style={[styles.iconWrap, focused && styles.iconActive]}>
            <Ionicons name={ICON[route.name] || 'ellipse'} size={focused ? 22 : 20} color={color} />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="watches" options={{ title: 'Watches' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
      <Tabs.Screen name="vault" options={{ title: 'Vault' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)',
  },
});
