import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/src/theme/theme';
import AppText from '@/src/components/AppText';
import GlassCard from '@/src/components/GlassCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import AuroraBackground from '@/src/components/AuroraBackground';
import { useAuth } from '@/src/context/AuthContext';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim() || undefined);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="register-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} style={styles.back} testID="register-back-btn" hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>

            <Animated.View entering={FadeInDown.duration(400)} style={styles.head}>
              <AppText weight="heading" size={32} style={{ letterSpacing: -1 }}>Create your vault</AppText>
              <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 6 }}>
                Bridge your watches. Own your data.
              </AppText>
            </Animated.View>

            <GlassCard style={{ marginTop: theme.space.lg }}>
              <Field icon="person-outline" placeholder="Name (optional)" value={name} onChangeText={setName} testID="register-name-input" />
              <View style={{ height: 12 }} />
              <Field icon="mail-outline" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="register-email-input" />
              <View style={{ height: 12 }} />
              <Field
                icon="lock-closed-outline"
                placeholder="Password (min 8 chars)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                testID="register-password-input"
                trailing={
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textDim} />
                  </Pressable>
                }
              />
              {err && (
                <AppText size={12} color={theme.colors.danger} style={{ marginTop: 10 }} testID="register-error">
                  {err}
                </AppText>
              )}
              <View style={{ height: 20 }} />
              <PrimaryButton title="Create Account" loading={loading} onPress={submit} testID="register-submit-btn" />
            </GlassCard>

            <View style={styles.privacyRow}>
              <Ionicons name="finger-print" size={14} color={theme.colors.textDim} />
              <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6, flex: 1 }}>
                By continuing you agree to E2E-encrypted storage of your data. Only you hold the key.
              </AppText>
            </View>

            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={styles.switch}
              testID="register-go-login"
            >
              <AppText size={13} color={theme.colors.textDim}>
                Already a member?{' '}
                <AppText size={13} weight="semi" color={theme.colors.teal}>Sign in</AppText>
              </AppText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field(props: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric';
  testID?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Ionicons name={props.icon} size={18} color={theme.colors.textDim} />
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.textMute}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        keyboardType={props.keyboardType}
        testID={props.testID}
      />
      {props.trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: theme.space.xl, flexGrow: 1 },
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
  input: {
    flex: 1, marginLeft: 10,
    color: theme.colors.text, fontSize: 15, fontFamily: theme.font.body,
    outlineStyle: 'none' as any,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space.md, paddingHorizontal: 4 },
  switch: { marginTop: theme.space.lg, alignItems: 'center', paddingVertical: 8 },
});
