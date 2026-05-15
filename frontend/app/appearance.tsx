import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, PRESET_THEMES, ThemeMode, Theme, spacing, radius } from '@/src/context/ThemeContext';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';

const THEME_MODES: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { id: 'auto', label: 'Auto', icon: 'sparkles', desc: 'System + time of day' },
  { id: 'system', label: 'System', icon: 'phone-portrait-outline', desc: 'Match device setting' },
  { id: 'schedule', label: 'Schedule', icon: 'time-outline', desc: 'Dark 7PM - 7AM' },
  { id: 'light', label: 'Light', icon: 'sunny-outline', desc: 'Always light' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline', desc: 'Always dark' },
];

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const { theme, themeId, themeMode, setThemeId, setThemeMode, availableThemes, isDark } = useTheme();
  const [hapticEnabled, setHapticEnabled] = useState(true);

  const handleThemeSelect = async (id: string) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setThemeId(id);
  };

  const handleModeSelect = async (mode: ThemeMode) => {
    if (hapticEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setThemeMode(mode);
  };

  const colors = theme.colors;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <AppText weight="heading" size={18} style={{ color: colors.text }}>Appearance</AppText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Current Theme Preview */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlassCard style={styles.previewCard} glow>
              <View style={styles.previewHeader}>
                <View style={[styles.previewIcon, { backgroundColor: colors.primaryDim }]}>
                  <AppText size={28}>{PRESET_THEMES[themeId]?.emoji || '🎨'}</AppText>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <AppText weight="heading" size={22} style={{ color: colors.text }}>
                    {PRESET_THEMES[themeId]?.name || 'Custom'}
                  </AppText>
                  <AppText size={12} style={{ color: colors.textDim, marginTop: 2 }}>
                    {isDark ? 'Dark theme' : 'Light theme'} • {themeMode === 'auto' ? 'Auto switching' : themeMode}
                  </AppText>
                </View>
              </View>
              
              {/* Color palette preview */}
              <View style={styles.paletteRow}>
                {[colors.primary, colors.secondary, colors.success, colors.warning, colors.danger].map((c, i) => (
                  <View key={i} style={[styles.paletteDot, { backgroundColor: c }]} />
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          {/* Mode Selection */}
          <AppText size={11} weight="med" style={[styles.sectionLabel, { color: colors.textDim }]}>
            Theme Mode
          </AppText>
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <GlassCard style={styles.modeCard}>
              {THEME_MODES.map((mode, idx) => (
                <Pressable
                  key={mode.id}
                  onPress={() => handleModeSelect(mode.id)}
                  style={[
                    styles.modeRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    themeMode === mode.id && { backgroundColor: colors.primaryDim },
                  ]}
                >
                  <View style={[styles.modeIcon, { backgroundColor: themeMode === mode.id ? colors.primary : colors.glass }]}>
                    <Ionicons name={mode.icon} size={18} color={themeMode === mode.id ? '#fff' : colors.textMute} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText weight="med" size={14} style={{ color: colors.text }}>{mode.label}</AppText>
                    <AppText size={11} style={{ color: colors.textMute }}>{mode.desc}</AppText>
                  </View>
                  {themeMode === mode.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </GlassCard>
          </Animated.View>

          {/* Theme Selection */}
          <AppText size={11} weight="med" style={[styles.sectionLabel, { color: colors.textDim }]}>
            Theme Colors
          </AppText>
          <View style={styles.themeGrid}>
            {availableThemes.map((t, idx) => (
              <Animated.View key={t.id} entering={FadeInRight.delay(idx * 50).duration(300)} style={styles.themeCardWrap}>
                <Pressable onPress={() => handleThemeSelect(t.id)}>
                  <ThemePreviewCard 
                    theme={t} 
                    isSelected={themeId === t.id}
                    currentTheme={theme}
                  />
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* Additional Settings */}
          <AppText size={11} weight="med" style={[styles.sectionLabel, { color: colors.textDim }]}>
            Preferences
          </AppText>
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <GlassCard style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                  <Ionicons name="hand-left-outline" size={18} color="#A855F7" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="med" size={14} style={{ color: colors.text }}>Haptic Feedback</AppText>
                  <AppText size={11} style={{ color: colors.textMute }}>Vibrate on interactions</AppText>
                </View>
                <Switch
                  value={hapticEnabled}
                  onValueChange={setHapticEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="contrast-outline" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="med" size={14} style={{ color: colors.text }}>Reduce Motion</AppText>
                  <AppText size={11} style={{ color: colors.textMute }}>Simpler animations</AppText>
                </View>
                <Switch
                  value={false}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Ionicons name="text-outline" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="med" size={14} style={{ color: colors.text }}>Large Text</AppText>
                  <AppText size={11} style={{ color: colors.textMute }}>Increase font sizes</AppText>
                </View>
                <Switch
                  value={false}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ThemePreviewCard({ theme: t, isSelected, currentTheme }: { theme: Theme; isSelected: boolean; currentTheme: Theme }) {
  const colors = currentTheme.colors;
  
  return (
    <View style={[
      styles.themeCard,
      { 
        backgroundColor: t.colors.surface,
        borderColor: isSelected ? currentTheme.colors.primary : t.colors.border,
        borderWidth: isSelected ? 2 : 1,
      }
    ]}>
      {/* Mini preview of theme */}
      <View style={[styles.themePreviewBg, { backgroundColor: t.colors.bg }]}>
        {/* Simulated card */}
        <View style={[styles.miniCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <View style={[styles.miniDot, { backgroundColor: t.colors.primary }]} />
          <View style={[styles.miniLine, { backgroundColor: t.colors.textDim }]} />
        </View>
        {/* Accent colors */}
        <View style={styles.miniAccents}>
          <View style={[styles.miniAccent, { backgroundColor: t.colors.primary }]} />
          <View style={[styles.miniAccent, { backgroundColor: t.colors.secondary }]} />
        </View>
      </View>
      
      {/* Theme name */}
      <View style={styles.themeInfo}>
        <AppText size={16} style={{ marginRight: 4 }}>{t.emoji}</AppText>
        <AppText size={12} weight="med" style={{ color: t.colors.text }}>{t.name}</AppText>
      </View>
      
      {/* Selected indicator */}
      {isSelected && (
        <View style={[styles.selectedBadge, { backgroundColor: currentTheme.colors.primary }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scroll: { paddingHorizontal: spacing.lg },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  
  // Preview card
  previewCard: { padding: spacing.lg },
  previewHeader: { flexDirection: 'row', alignItems: 'center' },
  previewIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  paletteRow: { flexDirection: 'row', marginTop: spacing.md, gap: 8 },
  paletteDot: { width: 24, height: 24, borderRadius: 12 },
  
  // Mode selection
  modeCard: { padding: 0, overflow: 'hidden' },
  modeRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  modeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  
  // Theme grid
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeCardWrap: { width: '48%' },
  themeCard: { borderRadius: radius.md, overflow: 'hidden' },
  themePreviewBg: { height: 80, padding: 10, justifyContent: 'space-between' },
  miniCard: { width: '60%', height: 28, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniLine: { flex: 1, height: 4, borderRadius: 2, marginLeft: 6 },
  miniAccents: { flexDirection: 'row', gap: 6 },
  miniAccent: { width: 20, height: 6, borderRadius: 3 },
  themeInfo: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  selectedBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  
  // Settings
  settingsCard: { padding: 0, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
