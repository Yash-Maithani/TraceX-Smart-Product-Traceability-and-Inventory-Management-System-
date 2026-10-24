import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  applyThemeToDocument,
  getSystemThemeMode,
  loadUiPreferences,
  saveUiPreferences,
  type ThemeAccent,
  type ThemeMode,
  type TableDensity,
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
  setTableDensity: (density: TableDensity) => void;
  /** Applies settings saved on the user's account (Phase 9). Unknown values are ignored. */
  applyAccountPreferences: (saved: AccountPreferences) => void;
}

export interface AccountPreferences {
  mode?: string | undefined;
  palette?: string | undefined;
  accent?: string | undefined;
  showPageImages?: boolean | undefined;
}

const PALETTES: readonly string[] = ['editorial', 'obsidian', 'emerald'];
const ACCENTS: readonly string[] = ['auto', 'cobalt', 'emerald', 'amber', 'rose'];

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

  const setTableDensity = useCallback((tableDensity: TableDensity) => {
    setPrefs((prev) => ({ ...prev, tableDensity }));
  }, []);

  const applyAccountPreferences = useCallback((saved: AccountPreferences) => {
    setPrefs((prev) => {
      const next: UiPreferences = { ...prev };
      if (saved.mode === 'system') {
        next.mode = getSystemThemeMode();
        next.modeSource = 'system';
      } else if (saved.mode === 'light' || saved.mode === 'dark') {
        next.mode = saved.mode;
        next.modeSource = 'manual';
      }
      if (saved.palette && PALETTES.includes(saved.palette)) next.palette = saved.palette as ThemePalette;
      if (saved.accent && ACCENTS.includes(saved.accent)) next.accent = saved.accent as ThemeAccent;
      if (typeof saved.showPageImages === 'boolean') next.showPageImages = saved.showPageImages;
      return next;
    });
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
        toggleShowPageImages,
        setTableDensity,
        applyAccountPreferences
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

/** For shared components that may render outside the provider (tests, isolated widgets). */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
