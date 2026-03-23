import { create } from 'zustand';
import { createClient, type Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';
import { SecureStoreAdapter } from '../lib/secure-store-adapter';
import { resetLocalDb } from '../lib/local-db';

// EXPO_PUBLIC_ vars are inlined at build time by Metro (Expo SDK 49+).
// Fall back to Constants.expoConfig.extra for dev-client builds.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase credentials missing. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not needed for mobile
  },
});

type AuthState = {
  session: Session | null;
  loading: boolean;
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,

  checkSession: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, loading: false });

      // Subscribe to auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, loading: false });
      });
    } catch (error) {
      set({ session: null, loading: false });
    }
  },

  signOut: async () => {
    try {
      // Wipe local DB before clearing session to prevent stale data across accounts
      await resetLocalDb().catch((err) =>
        console.error('[auth] resetLocalDb failed during sign-out:', err),
      );
      await supabase.auth.signOut();
      set({ session: null });
    } catch (error) {
      // Sign out locally even if the API call fails
      set({ session: null });
    }
  },
}));
