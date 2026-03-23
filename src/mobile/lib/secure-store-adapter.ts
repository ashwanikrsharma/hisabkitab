import * as SecureStore from 'expo-secure-store';

/**
 * Supabase storage adapter that uses Expo Secure Store.
 * Sessions are encrypted and persisted to the device keychain (iOS)
 * or Keystore (Android), surviving app restarts and crashes.
 *
 * Only the user explicitly signing out clears the session.
 */
export const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // SecureStore may fail on some devices — fall back to null
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail — session won't persist but app still works
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};
