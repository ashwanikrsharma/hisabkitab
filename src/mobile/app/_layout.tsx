// Polyfill WeakRef for Hermes engines that lack it
if (typeof (globalThis as Record<string, unknown>).WeakRef === 'undefined') {
  (globalThis as Record<string, unknown>).WeakRef = class WeakRefShim<T extends object> {
    private _ref: T | undefined;
    constructor(target: T) { this._ref = target; }
    deref(): T | undefined { return this._ref; }
  };
}

import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../components/theme-provider';
import { useTheme } from '../lib/theme';
import { initLocalDb, resetLocalDb, getDb } from '../lib/local-db';
import { startSyncEngine, triggerSync, setOnPullComplete } from '../lib/sync-engine';
import { registerForPushNotifications, deactivatePushNotification } from '../lib/notifications';
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
  const prevUserIdRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Hide splash screen once layout is mounted
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initLocalDb()
      .then(() => {
        // Invalidate React Query cache whenever sync pull brings new data
        setOnPullComplete(() => queryClient.invalidateQueries());
        cleanup = startSyncEngine();
      })
      .catch((err) =>
        console.error('[layout] Failed to init local DB:', err),
      );

    return () => cleanup?.();
  }, []);

  // Register/deactivate push notifications based on auth state
  useEffect(() => {
    if (session) {
      // User logged in — register for push notifications
      registerForPushNotifications()
        .then((token) => {
          pushTokenRef.current = token;
        })
        .catch((err) =>
          console.error('[layout] Push notification registration failed:', err),
        );
    } else if (pushTokenRef.current) {
      // User logged out — deactivate the push token
      const token = pushTokenRef.current;
      pushTokenRef.current = null;
      deactivatePushNotification(token).catch((err) =>
        console.error('[layout] Push token deactivation failed:', err),
      );
    }
  }, [session]);

  // On login: if the user changed, reset the local DB to avoid stale data from
  // a previous account. Then sync to populate fresh data, and invalidate queries.
  useEffect(() => {
    if (!session) {
      prevUserIdRef.current = null;
      return;
    }

    const currentUserId = session.user?.id ?? null;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    const syncAndInvalidate = async () => {
      // If switching accounts (or first login with stale DB), reset local DB
      if (prevUserId !== null && prevUserId !== currentUserId) {
        await resetLocalDb();
      } else if (prevUserId === null && currentUserId) {
        // First session in this app launch — check if DB belongs to a different user
        try {
          const database = getDb();
          const stored = await database.getFirstAsync<{ value: string }>(
            `SELECT value FROM sync_metadata WHERE key = 'current_user_id'`,
          );
          if (!stored || stored.value !== currentUserId) {
            // No stored user (legacy DB) or different user — reset to avoid stale data
            await resetLocalDb();
          }
        } catch {
          // DB not initialized yet — reset to be safe
          await resetLocalDb();
        }
        // Store current user ID for future checks
        try {
          const db2 = getDb();
          await db2.runAsync(
            `INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('current_user_id', ?)`,
            [currentUserId],
          );
        } catch {
          // Ignore — will be set on next sync
        }
      }

      await triggerSync();
      queryClient.invalidateQueries();
    };

    syncAndInvalidate().catch((err) => {
      console.warn('[layout] Post-login sync failed:', err);
      queryClient.invalidateQueries();
    });
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
