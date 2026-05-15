import { Stack } from 'expo-router';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { theme } from '@/src/theme/theme';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.is_admin) return <Redirect href="/(tabs)" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'fade',
      }}
    />
  );
}
