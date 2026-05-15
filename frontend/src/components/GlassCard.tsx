import React from 'react';
import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/src/theme/theme';

type Props = ViewProps & {
  intensity?: number;
  padded?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function GlassCard({ intensity = 40, padded = true, glow = false, style, children, ...rest }: Props) {
  return (
    <View style={[styles.wrap, padded && styles.padded, style]} {...rest}>
      {Platform.OS !== 'web' ? (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webBg]} />
      )}
      <LinearGradient
        colors={theme.gradients.cardSheen as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {glow && (
        <LinearGradient
          colors={theme.gradients.vaultGlow as any}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.lg }]}
          pointerEvents="none"
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(20,20,28,0.4)',
  },
  webBg: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)' as any,
  },
  padded: { padding: theme.space.lg },
  content: { position: 'relative' },
});
