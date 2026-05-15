import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useDerivedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingDef = {
  /** 0..1 */ progress: number;
  colorFrom: string;
  colorTo: string;
  width?: number;
  trackColor?: string;
};

type Props = {
  size?: number;
  rings: RingDef[];
  thickness?: number;
};

function Ring({
  size,
  radius,
  progress,
  colorFrom,
  colorTo,
  thickness,
  trackColor,
  gradId,
}: {
  size: number;
  radius: number;
  progress: number;
  colorFrom: string;
  colorTo: string;
  thickness: number;
  trackColor: string;
  gradId: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, sv]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - sv.value),
  }));

  return (
    <>
      <Defs>
        <SvgGrad id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colorFrom} />
          <Stop offset="1" stopColor={colorTo} />
        </SvgGrad>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={thickness}
        fill="none"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradId})`}
        strokeWidth={thickness}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </>
  );
}

export default function ActivityRings({ size = 180, rings, thickness = 14 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {rings.map((r, i) => {
          const radius = size / 2 - thickness / 2 - i * (thickness + 4);
          return (
            <Ring
              key={i}
              size={size}
              radius={radius}
              progress={r.progress}
              colorFrom={r.colorFrom}
              colorTo={r.colorTo}
              thickness={r.width ?? thickness}
              trackColor={r.trackColor ?? 'rgba(255,255,255,0.07)'}
              gradId={`ring-${i}`}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
