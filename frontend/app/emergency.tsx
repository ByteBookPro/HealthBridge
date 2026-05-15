import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'John Doe', phone: '+1 555-123-4567', relationship: 'Spouse' },
    { id: '2', name: 'Dr. Smith', phone: '+1 555-987-6543', relationship: 'Doctor' },
  ]);
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relationship: '' });
  const [fallDetection, setFallDetection] = useState(true);
  const [heartAlerts, setHeartAlerts] = useState(true);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (sosActive) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [sosActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const startSOS = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSosActive(true);
    setSosCountdown(5);
    
    countdownRef.current = setInterval(() => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          triggerEmergency();
          return 0;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOS = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setSosActive(false);
    setSosCountdown(5);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const triggerEmergency = async () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setSosActive(false);
    
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    
    // In production, this would:
    // 1. Send SMS to emergency contacts
    // 2. Share location
    // 3. Call emergency services if enabled
    Alert.alert(
      '🚨 Emergency Alert Sent',
      `Your emergency contacts have been notified with your location.\n\nContacts alerted: ${contacts.map(c => c.name).join(', ')}`,
      [
        { text: 'Call 911', onPress: () => Linking.openURL('tel:911'), style: 'destructive' },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Missing Info', 'Please enter name and phone number');
      return;
    }
    
    const contact: EmergencyContact = {
      id: Date.now().toString(),
      ...newContact,
    };
    setContacts(prev => [...prev, contact]);
    setNewContact({ name: '', phone: '', relationship: '' });
    setShowAddContact(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeContact = (id: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setContacts(prev => prev.filter(c => c.id !== id));
        }},
      ]
    );
  };

  const callContact = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
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
          <AppText weight="heading" size={18}>Emergency SOS</AppText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* SOS Button */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.sosContainer}>
            {sosActive ? (
              <View style={styles.sosActiveContainer}>
                <Animated.View style={[styles.sosPulse, pulseStyle]} />
                <Pressable onPress={cancelSOS} style={styles.sosButtonActive}>
                  <AppText weight="heading" size={56} color="#fff">{sosCountdown}</AppText>
                  <AppText size={14} color="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>Tap to cancel</AppText>
                </Pressable>
                <AppText size={14} color={theme.colors.danger} style={{ marginTop: 20, textAlign: 'center' }}>
                  Emergency alert will be sent in {sosCountdown} seconds
                </AppText>
              </View>
            ) : (
              <Pressable onPress={startSOS} onLongPress={triggerEmergency}>
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.sosButton}
                >
                  <Ionicons name="warning" size={48} color="#fff" />
                  <AppText weight="heading" size={20} color="#fff" style={{ marginTop: 12 }}>SOS</AppText>
                  <AppText size={11} color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>Press to activate</AppText>
                </LinearGradient>
              </Pressable>
            )}
            <AppText size={11} color={theme.colors.textMute} style={{ marginTop: 16, textAlign: 'center' }}>
              Long press for immediate emergency alert
            </AppText>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.quickActions}>
              <Pressable style={styles.quickAction} onPress={() => Linking.openURL('tel:911')}>
                <View style={[styles.quickIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons name="call" size={24} color="#EF4444" />
                </View>
                <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8 }}>Call 911</AppText>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => Linking.openURL('tel:911')}>
                <View style={[styles.quickIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="medkit" size={24} color="#3B82F6" />
                </View>
                <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8 }}>Medical ID</AppText>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={() => Linking.openURL('tel:911')}>
                <View style={[styles.quickIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <Ionicons name="location" size={24} color="#10B981" />
                </View>
                <AppText size={12} color={theme.colors.textDim} style={{ marginTop: 8 }}>Share Location</AppText>
              </Pressable>
            </View>
          </Animated.View>

          {/* Emergency Contacts */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            Emergency Contacts
          </AppText>
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <GlassCard style={styles.contactsCard}>
              {contacts.map((contact, idx) => (
                <View key={contact.id} style={[styles.contactRow, idx > 0 && styles.contactRowBorder]}>
                  <View style={styles.contactAvatar}>
                    <AppText weight="semi" size={16} color={theme.colors.teal}>
                      {contact.name.charAt(0)}
                    </AppText>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText weight="semi" size={14}>{contact.name}</AppText>
                    <AppText size={12} color={theme.colors.textMute}>{contact.relationship} • {contact.phone}</AppText>
                  </View>
                  <Pressable onPress={() => callContact(contact.phone)} style={styles.callBtn}>
                    <Ionicons name="call" size={18} color="#10B981" />
                  </Pressable>
                  <Pressable onPress={() => removeContact(contact.id)} style={{ marginLeft: 8 }}>
                    <Ionicons name="close-circle" size={22} color={theme.colors.textMute} />
                  </Pressable>
                </View>
              ))}
              
              <Pressable onPress={() => setShowAddContact(true)} style={styles.addContactBtn}>
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.teal} />
                <AppText size={13} color={theme.colors.teal} style={{ marginLeft: 8 }}>Add Emergency Contact</AppText>
              </Pressable>
            </GlassCard>
          </Animated.View>

          {/* Add Contact Modal */}
          {showAddContact && (
            <Animated.View entering={FadeInUp.duration(300)}>
              <GlassCard style={styles.addContactCard}>
                <AppText weight="semi" size={16} style={{ marginBottom: 16 }}>New Emergency Contact</AppText>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={theme.colors.textMute}
                  value={newContact.name}
                  onChangeText={(t) => setNewContact(p => ({ ...p, name: t }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={theme.colors.textMute}
                  keyboardType="phone-pad"
                  value={newContact.phone}
                  onChangeText={(t) => setNewContact(p => ({ ...p, phone: t }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Relationship (e.g., Spouse, Doctor)"
                  placeholderTextColor={theme.colors.textMute}
                  value={newContact.relationship}
                  onChangeText={(t) => setNewContact(p => ({ ...p, relationship: t }))}
                />
                <View style={styles.addContactActions}>
                  <Pressable onPress={() => setShowAddContact(false)} style={styles.cancelBtn}>
                    <AppText size={14} color={theme.colors.textMute}>Cancel</AppText>
                  </Pressable>
                  <Pressable onPress={addContact} style={styles.saveBtn}>
                    <AppText size={14} weight="semi" color={theme.colors.teal}>Save</AppText>
                  </Pressable>
                </View>
              </GlassCard>
            </Animated.View>
          )}

          {/* Safety Features */}
          <AppText size={11} color={theme.colors.textDim} weight="med" style={styles.sectionLabel}>
            Safety Features
          </AppText>
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <GlassCard style={styles.featuresCard}>
              <View style={styles.featureRow}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Ionicons name="body" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={14}>Fall Detection</AppText>
                  <AppText size={11} color={theme.colors.textMute}>Alert contacts if a hard fall is detected</AppText>
                </View>
                <Pressable 
                  onPress={() => setFallDetection(!fallDetection)}
                  style={[styles.toggle, fallDetection && styles.toggleActive]}
                >
                  <View style={[styles.toggleDot, fallDetection && styles.toggleDotActive]} />
                </Pressable>
              </View>
              
              <View style={[styles.featureRow, styles.featureRowBorder]}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons name="heart" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={14}>Heart Rate Alerts</AppText>
                  <AppText size={11} color={theme.colors.textMute}>Notify if HR is too high or too low</AppText>
                </View>
                <Pressable 
                  onPress={() => setHeartAlerts(!heartAlerts)}
                  style={[styles.toggle, heartAlerts && styles.toggleActive]}
                >
                  <View style={[styles.toggleDot, heartAlerts && styles.toggleDotActive]} />
                </Pressable>
              </View>
              
              <View style={[styles.featureRow, styles.featureRowBorder]}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                  <Ionicons name="moon" size={20} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={14}>Sleep Apnea Alerts</AppText>
                  <AppText size={11} color={theme.colors.textMute}>Detect breathing irregularities during sleep</AppText>
                </View>
                <View style={[styles.proBadge]}>
                  <AppText size={9} weight="semi" color={theme.colors.teal}>PRO</AppText>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Medical Info */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <GlassCard style={styles.medicalCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.featureIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="document-text" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <AppText weight="semi" size={14}>Medical ID</AppText>
                  <AppText size={11} color={theme.colors.textMute}>Blood type, allergies, medications</AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMute} />
              </View>
            </GlassCard>
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  scroll: { paddingHorizontal: theme.space.lg },
  sectionLabel: { marginTop: theme.space.lg, marginBottom: theme.space.sm, letterSpacing: 1.5, textTransform: 'uppercase' },
  
  sosContainer: { alignItems: 'center', marginVertical: 20 },
  sosButton: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  sosActiveContainer: { alignItems: 'center' },
  sosPulse: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(239,68,68,0.2)' },
  sosButtonActive: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  quickAction: { alignItems: 'center' },
  quickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
  contactsCard: { padding: 0, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  contactRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(45,212,191,0.15)', alignItems: 'center', justifyContent: 'center' },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  addContactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  
  addContactCard: { marginTop: 16, padding: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, color: theme.colors.text, fontSize: 14, marginBottom: 12 },
  addContactActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 16 },
  cancelBtn: { padding: 12 },
  saveBtn: { padding: 12 },
  
  featuresCard: { padding: 0, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  featureRowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', padding: 2 },
  toggleActive: { backgroundColor: 'rgba(45,212,191,0.3)' },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.textMute },
  toggleDotActive: { backgroundColor: theme.colors.teal, alignSelf: 'flex-end' },
  proBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(45,212,191,0.15)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(45,212,191,0.3)' },
  
  medicalCard: { marginTop: 16, padding: 16 },
});
