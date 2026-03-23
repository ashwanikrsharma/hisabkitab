import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../lib/theme';
import type { ColorTokens } from '../../lib/theme';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

const PAGES = [
  {
    icon: 'cash-outline' as const,
    title: 'Split expenses effortlessly',
    subtitle: 'Add expenses and let HisabKitab figure out who owes whom. No more awkward maths.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Track who owes whom',
    subtitle: 'See real-time balances across all your groups. Settle up with a single tap.',
  },
  {
    icon: 'flag-outline' as const,
    title: 'Built for India',
    subtitle: 'UPI payments, INR currency, paisa-level accuracy. Designed for how you split.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        bounces={false}
      >
        {PAGES.map((page, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <Ionicons name={page.icon} size={80} color={colors.primary} />
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.subtitle}>{page.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + Button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentPage && styles.dotActive]}
            />
          ))}
        </View>

        {isLastPage ? (
          <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export { ONBOARDING_KEY };

const createStyles = (colors: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 60,
    gap: 24,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 28,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 16,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
