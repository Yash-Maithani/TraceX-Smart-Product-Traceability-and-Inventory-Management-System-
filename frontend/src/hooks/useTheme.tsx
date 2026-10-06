import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  applyThemeToDocument,
  getSystemThemeMode,
  loadUiPreferences,
  saveUiPreferences,
  type ThemeAccent,
  type ThemeMode,
  type ThemePalette,
  type UiPreferences
} from '../lib/prefs';

interface ThemeContextValue {
  prefs: UiPreferences;
  setMode: (mode: ThemeMode) => void;
  resetModeToSystem: () => void;
  toggleMode: () => void;
  setPalette: (palette: ThemePalette) => void;
  setAccent: (accent: ThemeAccent) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setShowPageImages: (show: boolean) => void;
  toggleShowPageImages: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPreferences>(() => {
    const loaded = loadUiPreferences();
    applyThemeToDocument(loaded);
    return loaded;
  });

  useEffect(() => {
    applyThemeToDocument(prefs);
    saveUiPreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefs((prev) => {
        if (prev.modeSource !== 'system') return prev;
        return { ...prev, mode: e.matches ? 'dark' : 'light' };
      });
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    return undefined;
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, mode, modeSource: 'manual' }));
  }, []);

  const resetModeToSystem = useCallback(() => {
    setPrefs((prev) => ({ ...prev, mode: getSystemThemeMode(), modeSource: 'system' }));
  }, []);

  const toggleMode = useCallback(() => {
    setPrefs((prev) => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light',
      modeSource: 'manual'
    }));
  }, []);

  const setPalette = useCallback((palette: ThemePalette) => {
    setPrefs((prev) => ({ ...prev, palette }));
  }, []);

  const setAccent = useCallback((accent: ThemeAccent) => {
    setPrefs((prev) => ({ ...prev, accent }));
  }, []);

  const setSidebarCollapsed = useCallback((sidebarCollapsed: boolean) => {
    setPrefs((prev) => ({ ...prev, sidebarCollapsed }));
  }, []);

  const setShowPageImages = useCallback((showPageImages: boolean) => {
    setPrefs((prev) => ({ ...prev, showPageImages }));
  }, []);

  const toggleShowPageImages = useCallback(() => {
    setPrefs((prev) => ({ ...prev, showPageImages: !prev.showPageImages }));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        prefs,
        setMode,
        resetModeToSystem,
        toggleMode,
        setPalette,
        setAccent,
        setSidebarCollapsed,
        setShowPageImages,
        toggleShowPageImages
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
