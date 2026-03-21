import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../lib/theme';

const THEME_STORAGE_KEY = 'hisabkitab_theme_mode';

type ThemeState = {
  mode: ThemeMode;
  loaded: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  loadSaved: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  loaded: false,

  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  },

  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },

  loadSaved: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        set({ mode: saved, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
}));
