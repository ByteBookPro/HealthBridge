import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from './AppText';
import GlassCard from './GlassCard';
import Sparkline from './Sparkline';

interface CompactMetricCardProps {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  trend?: number[];
  delta?: number;
  sources?: ('apple' | 'samsung' | 'fitbit' | 'garmin' | 'google')[];
  testID?: string;
}

export default function CompactMetricCard({
  id,
  label,
  value,
  unit,
  icon,
  color,
  trend = [],
  delta = 0,
  sources = [],
  testID,
}: CompactMetricCardProps) {
  const router = useRouter();
  const positive = delta >= 0;

  return (
    <Pressable
      onPress={() => router.push(`/metric/${id}`)}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <GlassCard style={styles.card} testID={testID}>
        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
          <View style={styles.sourceIcons}>
            {sources.includes('apple') && (
              <View style={styles.sourceBadge}>
                <Ionicons name="logo-apple" size={8} color="#F3F4F6" />
              </View>
            )}
            {sources.includes('samsung') && (
              <View style={[styles.sourceBadge, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                <Ionicons name="phone-portrait" size={8} color="#3B82F6" />
              </View>
            )}
            {sources.includes('fitbit') && (
              <View style={[styles.sourceBadge, { backgroundColor: 'rgba(0,176,185,0.2)' }]}>
                <Ionicons name="fitness" size={8} color="#00B0B9" />
              </View>
            )}
            {sources.includes('garmin') && (
              <View style={[styles.sourceBadge, { backgroundColor: 'rgba(0,125,195,0.2)' }]}>
                <Ionicons name="navigate" size={8} color="#007DC3" />
              </View>
            )}
          </View>
        </View>
        
        <AppText size={10} color={theme.colors.textDim} style={{ marginTop: 6 }}>
          {label}
        </AppText>
        
        <View style={styles.valueRow}>
          <AppText weight="heading" size={22} style={{ letterSpacing: -0.5 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </AppText>
          <AppText size={10} color={theme.colors.textMute} style={{ marginLeft: 4, marginBottom: 2 }}>
            {unit}
          </AppText>
        </View>

        {trend.length > 0 && (
          <View style={styles.sparkContainer}>
            <Sparkline data={trend} color={color} width={80} height={20} />
          </View>
        )}

        {delta !== 0 && (
          <View style={[styles.delta, { backgroundColor: positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
            <Ionicons
              name={positive ? 'trending-up' : 'trending-down'}
              size={8}
              color={positive ? theme.colors.emerald : theme.colors.danger}
            />
            <AppText
              size={8}
              weight="semi"
              color={positive ? theme.colors.emerald : theme.colors.danger}
              style={{ marginLeft: 2 }}
            >
              {Math.abs(delta).toFixed(1)}%
            </AppText>
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    minHeight: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  sourceBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(243,244,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  sparkContainer: {
    marginTop: 6,
  },
  delta: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
