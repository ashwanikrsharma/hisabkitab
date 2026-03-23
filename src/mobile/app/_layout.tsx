// Polyfill WeakRef for Hermes engines that lack it
if (typeof (globalThis as Record<string, unknown>).WeakRef === 'undefined') {
  (globalThis as Record<string, unknown>).WeakRef = class WeakRefShim<T extends object> {
    private _ref: T | undefined;
    constructor(target: T) { this._ref = target; }
    deref(): T | undefined { return this._ref; }
  };
}

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../components/theme-provider';
import { useTheme } from '../lib/theme';
import { initLocalDb } from '../lib/local-db';
import { startSyncEngine, triggerSync } from '../lib/sync-engine';
import { useAuthStore } from '../store/auth';

// Prevent splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    // Hide splash screen once layout is mounted
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initLocalDb()
      .then(() => {
        cleanup = startSyncEngine();
      })
      .catch((err) =>
        console.error('[layout] Failed to init local DB:', err),
      );

    return () => cleanup?.();
  }, []);

  // Trigger a full server sync whenever a new session is detected (login)
  useEffect(() => {
    if (session) {
      triggerSync().catch((err) =>
        console.error('[layout] Post-login sync failed:', err),
      );
    }
  }, [session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ThemedStatusBar />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
