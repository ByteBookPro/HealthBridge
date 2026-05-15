import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';

export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]} />
      <LinearGradient
        colors={['rgba(30,58,138,0.45)', 'rgba(15,118,110,0.2)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.blob, { top: -120, left: -80, width: 360, height: 360 }]}
      />
      <LinearGradient
        colors={['rgba(45,212,191,0.30)', 'rgba(59,130,246,0.15)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.blob, { top: 120, right: -120, width: 420, height: 420 }]}
      />
      <LinearGradient
        colors={['rgba(16,185,129,0.18)', 'transparent']}
        style={[styles.blob, { bottom: -100, left: -60, width: 320, height: 320 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', borderRadius: 9999, opacity: 0.95 },
});
