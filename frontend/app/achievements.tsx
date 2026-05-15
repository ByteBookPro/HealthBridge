import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: 'steps' | 'heart' | 'sleep' | 'workout' | 'streak' | 'special';
  requirement: number;
  current: number;
  unlocked: boolean;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const ACHIEVEMENTS: Achievement[] = [
  // Steps achievements
  { id: 'steps_5k', title: 'First Steps', description: 'Walk 5,000 steps in a day', icon: 'footsteps', color: '#10B981', category: 'steps', requirement: 5000, current: 5000, unlocked: true, unlockedAt: '2026-05-10', rarity: 'common' },
  { id: 'steps_10k', title: 'Daily Walker', description: 'Walk 10,000 steps in a day', icon: 'footsteps', color: '#10B981', category: 'steps', requirement: 10000, current: 10000, unlocked: true, unlockedAt: '2026-05-12', rarity: 'common' },
  { id: 'steps_15k', title: 'Power Walker', description: 'Walk 15,000 steps in a day', icon: 'footsteps', color: '#10B981', category: 'steps', requirement: 15000, current: 12500, unlocked: false, rarity: 'rare' },
  { id: 'steps_20k', title: 'Marathon Day', description: 'Walk 20,000 steps in a day', icon: 'footsteps', color: '#10B981', category: 'steps', requirement: 20000, current: 12500, unlocked: false, rarity: 'epic' },
  { id: 'steps_100k_week', title: 'Weekly Warrior', description: 'Walk 100,000 steps in a week', icon: 'trophy', color: '#F59E0B', category: 'steps', requirement: 100000, current: 87500, unlocked: false, rarity: 'epic' },
  
  // Heart rate achievements
  { id: 'heart_zone', title: 'In The Zone', description: 'Spend 30 min in cardio zone', icon: 'heart', color: '#EF4444', category: 'heart', requirement: 30, current: 30, unlocked: true, unlockedAt: '2026-05-14', rarity: 'common' },
  { id: 'heart_steady', title: 'Steady Heart', description: 'Maintain resting HR below 60 for a week', icon: 'heart', color: '#EF4444', category: 'heart', requirement: 7, current: 5, unlocked: false, rarity: 'rare' },
  { id: 'heart_hrv', title: 'HRV Champion', description: 'Achieve HRV above 50ms', icon: 'pulse', color: '#EF4444', category: 'heart', requirement: 50, current: 45, unlocked: false, rarity: 'epic' },
  
  // Sleep achievements
  { id: 'sleep_8h', title: 'Well Rested', description: 'Get 8 hours of sleep', icon: 'moon', color: '#8B5CF6', category: 'sleep', requirement: 8, current: 8, unlocked: true, unlockedAt: '2026-05-11', rarity: 'common' },
  { id: 'sleep_week', title: 'Sleep Champion', description: '8+ hours of sleep for 7 days', icon: 'moon', color: '#8B5CF6', category: 'sleep', requirement: 7, current: 4, unlocked: false, rarity: 'rare' },
  { id: 'sleep_quality', title: 'Dream Weaver', description: 'Achieve 90+ sleep score', icon: 'sparkles', color: '#8B5CF6', category: 'sleep', requirement: 90, current: 85, unlocked: false, rarity: 'epic' },
  
  // Workout achievements
  { id: 'workout_first', title: 'Getting Started', description: 'Complete your first workout', icon: 'barbell', color: '#F59E0B', category: 'workout', requirement: 1, current: 1, unlocked: true, unlockedAt: '2026-05-09', rarity: 'common' },
  { id: 'workout_10', title: 'Consistent', description: 'Complete 10 workouts', icon: 'barbell', color: '#F59E0B', category: 'workout', requirement: 10, current: 7, unlocked: false, rarity: 'rare' },
  { id: 'workout_vo2', title: 'Elite Fitness', description: 'Achieve VO2 Max above 50', icon: 'fitness', color: '#F59E0B', category: 'workout', requirement: 50, current: 42, unlocked: false, rarity: 'legendary' },
  
  // Streak achievements
  { id: 'streak_7', title: 'One Week Strong', description: '7-day activity streak', icon: 'flame', color: '#F97316', category: 'streak', requirement: 7, current: 7, unlocked: true, unlockedAt: '2026-05-15', rarity: 'common' },
  { id: 'streak_30', title: 'Monthly Master', description: '30-day activity streak', icon: 'flame', color: '#F97316', category: 'streak', requirement: 30, current: 14, unlocked: false, rarity: 'epic' },
  { id: 'streak_100', title: 'Century Club', description: '100-day activity streak', icon: 'diamond', color: '#F97316', category: 'streak', requirement: 100, current: 14, unlocked: false, rarity: 'legendary' },
  
  // Special achievements
  { id: 'special_early', title: 'Early Bird', description: 'Complete a workout before 6 AM', icon: 'sunny', color: '#3B82F6', category: 'special', requirement: 1, current: 0, unlocked: false, rarity: 'rare' },
  { id: 'special_night', title: 'Night Owl', description: 'Log 10,000 steps after 8 PM', icon: 'moon', color: '#3B82F6', category: 'special', requirement: 1, current: 0, unlocked: false, rarity: 'rare' },
  { id: 'special_perfect', title: 'Perfect Day', description: 'Hit all daily goals in one day', icon: 'ribbon', color: '#EC4899', category: 'special', requirement: 1, current: 0, unlocked: false, rarity: 'legendary' },
];

const RARITY_COLORS = {
  common: { bg: 'rgba(148,163,184,0.15)', border: '#94A3B8', text: '#94A3B8' },
  rare: { bg: 'rgba(59,130,246,0.15)', border: '#3B82F6', text: '#3B82F6' },
  epic: { bg: 'rgba(168,85,247,0.15)', border: '#A855F7', text: '#A855F7' },
  legendary: { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#F59E0B' },
};

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'steps', label: 'Steps', icon: 'footsteps' },
  { id: 'heart', label: 'Heart', icon: 'heart' },
  { id: 'sleep', label: 'Sleep', icon: 'moon' },
  { id: 'workout', label: 'Workout', icon: 'barbell' },
  { id: 'streak', label: 'Streaks', icon: 'flame' },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [achievements] = useState(ACHIEVEMENTS);

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalPoints = achievements.filter(a => a.unlocked).reduce((sum, a) => {
    const points = { common: 10, rare: 25, epic: 50, legendary: 100 };
    return sum + points[a.rarity];
  }, 0);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <AppText weight="heading" size={18}>Achievements</AppText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Stats Overview */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={styles.statsCard} glow>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <AppText weight="heading" size={32} color={theme.colors.teal}>{unlockedCount}</AppText>
                  <AppText size={12} color={theme.colors.textDim}>Unlocked</AppText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <AppText weight="heading" size={32} color={theme.colors.teal}>{achievements.length}</AppText>
                  <AppText size={12} color={theme.colors.textDim}>Total</AppText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <AppText weight="heading" size={32} color="#F59E0B">{totalPoints}</AppText>
                  <AppText size={12} color={theme.colors.textDim}>Points</AppText>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(unlockedCount / achievements.length) * 100}%` }]} />
              </View>
              <AppText size={11} color={theme.colors.textMute} style={{ marginTop: 8, textAlign: 'center' }}>
                {Math.round((unlockedCount / achievements.length) * 100)}% Complete
              </AppText>
            </GlassCard>
          </Animated.View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map((cat, i) => (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.categoryBtn, selectedCategory === cat.id && styles.categoryBtnActive]}
              >
                <Ionicons name={cat.icon as any} size={16} color={selectedCategory === cat.id ? theme.colors.teal : theme.colors.textMute} />
                <AppText size={12} color={selectedCategory === cat.id ? theme.colors.teal : theme.colors.textMute} style={{ marginLeft: 6 }}>
                  {cat.label}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>

          {/* Achievements Grid */}
          <View style={styles.achievementsGrid}>
            {filteredAchievements.map((achievement, idx) => (
              <Animated.View key={achievement.id} entering={FadeInRight.delay(idx * 50).duration(300)} style={styles.achievementWrap}>
                <AchievementCard achievement={achievement} />
              </Animated.View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const rarityStyle = RARITY_COLORS[achievement.rarity];
  const progress = Math.min(100, (achievement.current / achievement.requirement) * 100);

  return (
    <GlassCard style={[styles.achievementCard, !achievement.unlocked && styles.achievementLocked]}>
      {/* Rarity badge */}
      <View style={[styles.rarityBadge, { backgroundColor: rarityStyle.bg, borderColor: rarityStyle.border }]}>
        <AppText size={8} weight="semi" color={rarityStyle.text} style={{ textTransform: 'uppercase' }}>
          {achievement.rarity}
        </AppText>
      </View>

      {/* Icon */}
      <View style={[styles.achievementIcon, { backgroundColor: achievement.unlocked ? `${achievement.color}22` : 'rgba(100,116,139,0.15)' }]}>
        {achievement.unlocked ? (
          <Ionicons name={achievement.icon as any} size={28} color={achievement.color} />
        ) : (
          <Ionicons name="lock-closed" size={24} color={theme.colors.textMute} />
        )}
      </View>

      {/* Title & Description */}
      <AppText weight="semi" size={13} style={{ marginTop: 10, textAlign: 'center' }} numberOfLines={1}>
        {achievement.title}
      </AppText>
      <AppText size={10} color={theme.colors.textMute} style={{ marginTop: 4, textAlign: 'center' }} numberOfLines={2}>
        {achievement.description}
      </AppText>

      {/* Progress */}
      {!achievement.unlocked && (
        <View style={styles.achievementProgress}>
          <View style={styles.achievementProgressBar}>
            <View style={[styles.achievementProgressFill, { width: `${progress}%`, backgroundColor: achievement.color }]} />
          </View>
          <AppText size={9} color={theme.colors.textMute} style={{ marginTop: 4 }}>
            {achievement.current.toLocaleString()} / {achievement.requirement.toLocaleString()}
          </AppText>
        </View>
      )}

      {/* Unlocked date */}
      {achievement.unlocked && achievement.unlockedAt && (
        <AppText size={9} color={theme.colors.emerald} style={{ marginTop: 8 }}>
          ✓ {new Date(achievement.unlockedAt).toLocaleDateString()}
        </AppText>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  scroll: { paddingHorizontal: theme.space.lg },
  
  statsCard: { padding: theme.space.lg },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: theme.colors.border },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.teal, borderRadius: 3 },
  
  categoryScroll: { marginTop: theme.space.lg },
  categoryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  categoryBtnActive: { backgroundColor: 'rgba(45,212,191,0.15)', borderColor: 'rgba(45,212,191,0.3)' },
  
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.space.md, gap: 12 },
  achievementWrap: { width: (SCREEN_WIDTH - 60) / 2 },
  achievementCard: { padding: 16, alignItems: 'center', minHeight: 180 },
  achievementLocked: { opacity: 0.7 },
  rarityBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  achievementIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  achievementProgress: { marginTop: 10, width: '100%', alignItems: 'center' },
  achievementProgressBar: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  achievementProgressFill: { height: '100%', borderRadius: 2 },
});
