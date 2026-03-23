import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/auth';
import { useTheme } from '../lib/theme';
import type { ColorTokens } from '../lib/theme';

const ONBOARDING_KEY = 'hasSeenOnboarding';

/**
 * Root index — redirect based on:
 * 1. Has seen onboarding? → if not, go to onboarding
 * 2. Has session? → if yes, go to tabs; if not, go to login
 */
export default function Index() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const checkSession = useAuthStore((s) => s.checkSession);

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    checkSession();
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setHasSeenOnboarding(value === 'true');
      setOnboardingChecked(true);
    });
  }, [checkSession]);

  if (loading || !onboardingChecked) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
