import React, { useState } from 'react';
import { View, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import GlassCard from './GlassCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface HealthCategoryProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
  testID?: string;
}

export default function HealthCategory({
  title,
  icon,
  color,
  children,
  initiallyExpanded = true,
  testID,
}: HealthCategoryProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container} testID={testID}>
      <Pressable onPress={toggle} style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <AppText weight="semi" size={14} style={{ flex: 1, marginLeft: 12 }}>
          {title}
        </AppText>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMute}
        />
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: 8,
  },
});
