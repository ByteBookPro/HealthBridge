import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { api } from '@/src/api/client';

export default function Forgot() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sendReset = async () => {
    setErr(null); setLoading(true);
    try {
      const r = await api.forgotPassword(email.trim().toLowerCase());
      // Dev: backend returns token directly. In prod, this would be sent by email.
      if (r.reset_token_dev_only) {
        setToken(r.reset_token_dev_only);
        Alert.alert('Reset token issued (dev)', 'Token has been pre-filled. In production this is emailed.');
      }
      setStage('reset');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    setErr(null);
    if (newPw.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, newPw);
      Alert.alert('Password updated', 'You can now sign in with your new password.');
      router.replace('/(auth)/login');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.root} testID="forgot-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} style={styles.back} testID="forgot-back" hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={styles.head}>
              <AppText weight="heading" size={28} style={{ letterSpacing: -0.5 }}>
                {stage === 'request' ? 'Reset password' : 'Set new password'}
              </AppText>
              <AppText size={13} color={theme.colors.textDim} style={{ marginTop: 6 }}>
                {stage === 'request'
                  ? 'We\'ll send you a one-time reset token.'
                  : 'Paste the token from your email and choose a new password.'}
              </AppText>
            </View>
            <GlassCard style={{ marginTop: theme.space.lg }}>
              {stage === 'request' ? (
                <>
                  <View style={styles.field}>
                    <Ionicons name="mail-outline" size={18} color={theme.colors.textDim} />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={theme.colors.textMute}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      testID="forgot-email"
                    />
                  </View>
                  {err && <AppText size={12} color={theme.colors.danger} style={{ marginTop: 10 }}>{err}</AppText>}
                  <View style={{ height: 18 }} />
                  <PrimaryButton title="Send reset link" onPress={sendReset} loading={loading} testID="forgot-submit" />
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Ionicons name="key-outline" size={18} color={theme.colors.textDim} />
                    <TextInput
                      style={styles.input}
                      placeholder="Reset token"
                      placeholderTextColor={theme.colors.textMute}
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="none"
                      testID="reset-token"
                    />
                  </View>
                  <View style={{ height: 10 }} />
                  <View style={styles.field}>
                    <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textDim} />
                    <TextInput
                      style={styles.input}
                      placeholder="New password (min 8 chars)"
                      placeholderTextColor={theme.colors.textMute}
                      value={newPw}
                      onChangeText={setNewPw}
                      secureTextEntry
                      testID="reset-new-pw"
                    />
                  </View>
                  {err && <AppText size={12} color={theme.colors.danger} style={{ marginTop: 10 }}>{err}</AppText>}
                  <View style={{ height: 18 }} />
                  <PrimaryButton title="Update password" onPress={submitReset} loading={loading} testID="reset-submit" />
                </>
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingHorizontal: theme.space.lg, flexGrow: 1, paddingBottom: theme.space.xl },
  back: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
    marginTop: theme.space.sm,
  },
  head: { marginTop: theme.space.xl },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radii.md, paddingHorizontal: 14, height: 52,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  input: { flex: 1, marginLeft: 10, color: theme.colors.text, fontSize: 15, fontFamily: theme.font.body, outlineStyle: 'none' as any },
});
