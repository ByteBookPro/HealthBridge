import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import AuroraBackground from '@/src/components/AuroraBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GLASS_SIZES = [
  { ml: 150, label: 'Small', icon: 'cafe-outline' },
  { ml: 250, label: 'Medium', icon: 'water-outline' },
  { ml: 350, label: 'Large', icon: 'pint-outline' },
  { ml: 500, label: 'Bottle', icon: 'flask-outline' },
];

const DRINK_TYPES = [
  { id: 'water', label: 'Water', icon: 'water', color: '#3B82F6', hydration: 1.0 },
  { id: 'tea', label: 'Tea', icon: 'cafe', color: '#10B981', hydration: 0.9 },
  { id: 'coffee', label: 'Coffee', icon: 'cafe', color: '#92400E', hydration: 0.8 },
  { id: 'juice', label: 'Juice', icon: 'nutrition', color: '#F59E0B', hydration: 0.85 },
  { id: 'milk', label: 'Milk', icon: 'beaker', color: '#E5E7EB', hydration: 0.9 },
  { id: 'soda', label: 'Soda', icon: 'beer', color: '#EF4444', hydration: 0.5 },
];

interface WaterEntry {
  id: string;
  amount: number;
  type: string;
  time: Date;
}

export default function WaterTrackingScreen() {
  const router = useRouter();
  const [dailyGoal] = useState(2500); // ml
  const [entries, setEntries] = useState<WaterEntry[]>([
    { id: '1', amount: 250, type: 'water', time: new Date(Date.now() - 3600000 * 3) },
    { id: '2', amount: 350, type: 'coffee', time: new Date(Date.now() - 3600000 * 2) },
    { id: '3', amount: 250, type: 'water', time: new Date(Date.now() - 3600000) },
  ]);
  const [selectedSize, setSelectedSize] = useState(1);
  const [selectedType, setSelectedType] = useState('water');
  
  const totalIntake = entries.reduce((sum, e) => {
    const drink = DRINK_TYPES.find(d => d.id === e.type);
    return sum + (e.amount * (drink?.hydration || 1));
  }, 0);
  const progress = Math.min(100, (totalIntake / dailyGoal) * 100);
  const remaining = Math.max(0, dailyGoal - totalIntake);

  const waterLevel = useSharedValue(progress / 100);
  
  useEffect(() => {
    waterLevel.value = withSpring(progress / 100, { damping: 15 });
  }, [progress]);

  const addWater = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newEntry: WaterEntry = {
      id: Date.now().toString(),
      amount: GLASS_SIZES[selectedSize].ml,
      type: selectedType,
      time: new Date(),
    };
    setEntries(prev => [newEntry, ...prev]);
    
    if (totalIntake + GLASS_SIZES[selectedSize].ml >= dailyGoal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const removeEntry = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <AppText weight="heading" size={18}>Hydration</AppText>
          <Pressable style={styles.backBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Water Glass Visual */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <GlassCard style={styles.mainCard} glow>
              <View style={styles.glassContainer}>
                <WaterGlass progress={progress} />
                <View style={styles.glassStats}>
                  <AppText weight="heading" size={48} color="#3B82F6">
                    {Math.round(totalIntake)}
                  </AppText>
                  <AppText size={14} color={theme.colors.textDim}>of {dailyGoal} ml</AppText>
                  <View style={styles.remainingBadge}>
                    <Ionicons name="water-outline" size={14} color={theme.colors.textMute} />
                    <AppText size={12} color={theme.colors.textMute} style={{ marginLeft: 4 }}>
                      {remaining} ml remaining
                    </AppText>
                  </View>
                </View>
              </View>
              
              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={['#3B82F6', '#60A5FA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <AppText size={12} weight="semi" color="#3B82F6" style={{ marginTop: 8 }}>
                  {Math.round(progress)}% of daily goal
                </AppText>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Quick Add Section */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            Quick Add
          </AppText>
          
          {/* Size Selection */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sizeRow}>
                {GLASS_SIZES.map((size, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSelectedSize(i);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.sizeBtn, selectedSize === i && styles.sizeBtnActive]}
                  >
                    <Ionicons 
                      name={size.icon as any} 
                      size={24} 
                      color={selectedSize === i ? '#3B82F6' : theme.colors.textMute} 
                    />
                    <AppText size={14} weight="semi" color={selectedSize === i ? '#3B82F6' : theme.colors.text} style={{ marginTop: 6 }}>
                      {size.ml}ml
                    </AppText>
                    <AppText size={10} color={theme.colors.textMute}>{size.label}</AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>

          {/* Drink Type Selection */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
              <View style={styles.typeRow}>
                {DRINK_TYPES.map((drink) => (
                  <Pressable
                    key={drink.id}
                    onPress={() => {
                      setSelectedType(drink.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.typeBtn, selectedType === drink.id && { borderColor: drink.color, backgroundColor: `${drink.color}15` }]}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: `${drink.color}22` }]}>
                      <Ionicons name={drink.icon as any} size={18} color={drink.color} />
                    </View>
                    <AppText size={11} color={selectedType === drink.id ? drink.color : theme.colors.textMute}>
                      {drink.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>

          {/* Add Button */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Pressable onPress={addWater} style={styles.addButton}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.addButtonGradient}
              >
                <Ionicons name="add" size={28} color="#fff" />
                <AppText weight="semi" size={16} color="#fff" style={{ marginLeft: 8 }}>
                  Add {GLASS_SIZES[selectedSize].ml}ml {DRINK_TYPES.find(d => d.id === selectedType)?.label}
                </AppText>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Today's Log */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            Today's Log
          </AppText>
          <GlassCard style={styles.logCard}>
            {entries.length === 0 ? (
              <View style={styles.emptyLog}>
                <Ionicons name="water-outline" size={40} color={theme.colors.textMute} />
                <AppText size={13} color={theme.colors.textMute} style={{ marginTop: 12 }}>
                  No drinks logged yet today
                </AppText>
              </View>
            ) : (
              entries.map((entry, idx) => {
                const drink = DRINK_TYPES.find(d => d.id === entry.type);
                return (
                  <View key={entry.id} style={[styles.logEntry, idx > 0 && styles.logEntryBorder]}>
                    <View style={[styles.logIcon, { backgroundColor: `${drink?.color}22` }]}>
                      <Ionicons name={drink?.icon as any} size={18} color={drink?.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText weight="med" size={14}>{entry.amount}ml {drink?.label}</AppText>
                      <AppText size={11} color={theme.colors.textMute}>
                        {entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </AppText>
                    </View>
                    <Pressable onPress={() => removeEntry(entry.id)} hitSlop={10}>
                      <Ionicons name="close-circle" size={22} color={theme.colors.textMute} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </GlassCard>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WaterGlass({ progress }: { progress: number }) {
  const height = 140;
  const width = 100;
  const waterHeight = (progress / 100) * (height - 20);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#60A5FA" />
          <Stop offset="1" stopColor="#3B82F6" />
        </SvgLinearGradient>
        <SvgLinearGradient id="glassGradient" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="rgba(255,255,255,0.1)" />
          <Stop offset="0.5" stopColor="rgba(255,255,255,0.2)" />
          <Stop offset="1" stopColor="rgba(255,255,255,0.1)" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Glass outline */}
      <Path
        d={`M 15 10 L 10 ${height - 10} Q 10 ${height} 20 ${height} L ${width - 20} ${height} Q ${width - 10} ${height} ${width - 10} ${height - 10} L ${width - 15} 10 Z`}
        fill="url(#glassGradient)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
      />
      
      {/* Water fill */}
      {progress > 0 && (
        <Path
          d={`M 12 ${height - 12 - waterHeight} 
              Q ${width / 2} ${height - 8 - waterHeight - 5} ${width - 12} ${height - 12 - waterHeight}
              L ${width - 11} ${height - 12} 
              Q ${width - 11} ${height - 2} ${width - 20} ${height - 2} 
              L 20 ${height - 2} 
              Q 11 ${height - 2} 11 ${height - 12} Z`}
          fill="url(#waterGradient)"
          opacity={0.9}
        />
      )}
      
      {/* Bubbles */}
      {progress > 20 && (
        <>
          <Circle cx={30} cy={height - 30} r={3} fill="rgba(255,255,255,0.4)" />
          <Circle cx={50} cy={height - 50} r={2} fill="rgba(255,255,255,0.3)" />
          <Circle cx={70} cy={height - 35} r={2.5} fill="rgba(255,255,255,0.35)" />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  scroll: { paddingHorizontal: theme.space.lg },
  sectionLabel: { marginTop: theme.space.lg, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  
  mainCard: { padding: theme.space.lg },
  glassContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  glassStats: { alignItems: 'center' },
  remainingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  progressContainer: { marginTop: 24 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  
  sizeRow: { flexDirection: 'row', gap: 12 },
  sizeBtn: { width: 80, padding: 14, alignItems: 'center', backgroundColor: theme.colors.glass, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  sizeBtnActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.1)' },
  
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { alignItems: 'center', padding: 12, backgroundColor: theme.colors.glass, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, minWidth: 70 },
  typeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  
  addButton: { marginTop: 20 },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  
  logCard: { padding: 0, overflow: 'hidden' },
  emptyLog: { padding: 32, alignItems: 'center' },
  logEntry: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  logEntryBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  logIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
