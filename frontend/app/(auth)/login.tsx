import React, { useState } from 'react';
import {
  View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable,
  ScrollView,
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

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@healthbridge.app');
  const [password, setPassword] = useState('Demo1234!');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} style={styles.back} testID="login-back-btn" hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </Pressable>

            <Animated.View entering={FadeInDown.duration(400)} style={styles.head}>
              <AppText weight="heading" size={32} style={{ letterSpacing: -1 }}>Welcome back</AppText>
              <AppText size={14} color={theme.colors.textDim} style={{ marginTop: 6 }}>
                Sign in to unlock your unified health vault.
              </AppText>
            </Animated.View>

            <GlassCard style={{ marginTop: theme.space.lg }}>
              <Field
                icon="mail-outline"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="login-email-input"
              />
              <View style={{ height: 12 }} />
              <Field
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                testID="login-password-input"
                trailing={
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textDim} />
                  </Pressable>
                }
              />
              {err && (
                <AppText size={12} color={theme.colors.danger} style={{ marginTop: 10 }} testID="login-error">
                  {err}
                </AppText>
              )}
              <View style={{ height: 20 }} />
              <PrimaryButton title="Sign In" loading={loading} onPress={submit} testID="login-submit-btn" />
            </GlassCard>

            <View style={styles.privacyRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.textDim} />
              <AppText size={11} color={theme.colors.textDim} style={{ marginLeft: 6 }}>
                Zero-knowledge encryption. We never read your health data.
              </AppText>
            </View>

            <Pressable
              onPress={() => router.push('/(auth)/register')}
              style={styles.switch}
              testID="login-go-register"
            >
              <AppText size={13} color={theme.colors.textDim}>
                New here?{' '}
                <AppText size={13} weight="semi" color={theme.colors.teal}>Create an account</AppText>
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
