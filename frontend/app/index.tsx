import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { theme } from '@/src/theme/theme';

export default function Index() {
  const { loading, isAuthed } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isAuthed) router.replace('/(tabs)');
    else router.replace('/onboarding');
  }, [loading, isAuthed, router]);

  return (
    <View style={styles.c}>
      <ActivityIndicator color={theme.colors.teal} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
});
