import React from 'react';
import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { theme } from '@/src/theme/theme';

type Weight = 'reg' | 'med' | 'semi' | 'bold' | 'heading' | 'headingMed' | 'headingReg';

type Props = TextProps & {
  size?: number;
  weight?: Weight;
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
};

const weightMap: Record<Weight, string> = {
  reg: theme.font.body,
  med: theme.font.bodyMed,
  semi: theme.font.bodySemi,
  bold: theme.font.bodyBold,
  heading: theme.font.heading,
  headingMed: theme.font.headingMed,
  headingReg: theme.font.headingReg,
};

export default function AppText({ size = 14, weight = 'reg', color, style, children, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: weightMap[weight], fontSize: size, color: color ?? theme.colors.text, lineHeight: Math.round(size * 1.4) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
