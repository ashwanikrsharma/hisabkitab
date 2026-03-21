import { useEffect, useMemo } from 'react';
import { ThemeContext, getColors } from '../lib/theme';
import { useThemeStore } from '../store/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const toggle = useThemeStore((s) => s.toggle);
  const loadSaved = useThemeStore((s) => s.loadSaved);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const value = useMemo(
    () => ({
      mode,
      colors: getColors(mode),
      setMode,
      toggle,
    }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
