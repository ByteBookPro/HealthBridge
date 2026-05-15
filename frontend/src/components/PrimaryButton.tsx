import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, type GestureResponderEvent, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
};

export default function PrimaryButton({
  title, onPress, variant = 'primary', loading, disabled, testID, icon, fullWidth = true,
}: Props) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    scale.value = withTiming(1, { duration: 150 });
  }, [scale]);

  const onIn = () => { scale.value = withTiming(0.97, { duration: 100 }); };
  const onOut = () => { scale.value = withTiming(1, { duration: 100 }); };

  const isDisabled = disabled || loading;

  const inner = (
    <View style={[styles.row, !fullWidth && { paddingHorizontal: theme.space.lg }]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon}
          <AppText weight="semi" size={16} style={{ color: variant === 'ghost' ? theme.colors.text : '#fff' }}>
            {title}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <Animated.View style={[fullWidth && { width: '100%' }, aStyle]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={isDisabled}
        style={[styles.base, isDisabled && { opacity: 0.5 }]}
      >
        {variant === 'primary' && (
          <LinearGradient
            colors={theme.gradients.primaryBtn as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {variant === 'secondary' && <View style={[StyleSheet.absoluteFill, styles.secondary]} />}
        {variant === 'ghost' && <View style={[StyleSheet.absoluteFill, styles.ghost]} />}
        {variant === 'danger' && <View style={[StyleSheet.absoluteFill, styles.danger]} />}
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: theme.radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secondary: {
    backgroundColor: theme.colors.glassMed,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.full,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: theme.radii.full,
  },
});
