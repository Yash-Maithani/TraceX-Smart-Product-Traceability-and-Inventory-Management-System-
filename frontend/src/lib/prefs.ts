/**
 * UI Preferences storage (SPEC §5.1, §5.2, Phase 5 & Phase 5.1).
 * This is the ONLY module in the application permitted to access `localStorage`,
 * and it stores ONLY non-sensitive visual preferences (theme mode, palette, accent, sidebar state, showPageImages).
 * Authentication tokens are NEVER stored here (they live exclusively in sessionStorage via tokenStore.ts).
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'editorial' | 'obsidian' | 'emerald';
export type ThemeAccent = 'auto' | 'cobalt' | 'emerald' | 'amber' | 'rose';
export type ResolvedAccent = 'cobalt' | 'emerald' | 'amber' | 'rose';

export interface UiPreferences {
  mode: ThemeMode;
  modeSource: 'system' | 'manual';
  palette: ThemePalette;
  accent: ThemeAccent;
  sidebarCollapsed: boolean;
  showPageImages: boolean;
}

const PREFS_STORAGE_KEY = 'tx_ui_prefs';

export function getSystemThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
}

export function isSaveDataActive(): boolean {
  if (typeof document !== 'undefined') {
    if (document.documentElement.getAttribute('data-save-data') === 'on') {
      return true;
    }
  }
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn && conn.saveData === true) {
      return true;
    }
  }
  return false;
}

export function resolveAccent(palette: ThemePalette, accent: ThemeAccent): ResolvedAccent {
  if (accent !== 'auto') {
    return accent;
  }
  switch (palette) {
    case 'emerald':
      return 'emerald';
    case 'obsidian':
      return 'amber';
    case 'editorial':
    default:
      return 'cobalt';
  }
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  mode: 'light',
  modeSource: 'system',
  palette: 'editorial',
  accent: 'auto',
  sidebarCollapsed: false,
  showPageImages: true
};

const VALID_MODES: readonly ThemeMode[] = ['light', 'dark'];
const VALID_PALETTES: readonly ThemePalette[] = ['editorial', 'obsidian', 'emerald'];
const VALID_ACCENTS: readonly ThemeAccent[] = ['auto', 'cobalt', 'emerald', 'amber', 'rose'];

export function loadUiPreferences(): UiPreferences {
  const systemMode = getSystemThemeMode();
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_UI_PREFERENCES, mode: systemMode, modeSource: 'system' };
    }
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    const modeSource = parsed.modeSource === 'manual' ? 'manual' : 'system';
    const mode =
      modeSource === 'manual' && VALID_MODES.includes(parsed.mode as ThemeMode)
        ? (parsed.mode as ThemeMode)
        : VALID_MODES.includes(parsed.mode as ThemeMode) && parsed.modeSource === undefined
          ? (parsed.mode as ThemeMode)
          : systemMode;
    return {
      mode,
      modeSource: parsed.mode && parsed.modeSource === undefined ? 'manual' : modeSource,
      palette: VALID_PALETTES.includes(parsed.palette as ThemePalette)
        ? (parsed.palette as ThemePalette)
        : DEFAULT_UI_PREFERENCES.palette,
      accent: VALID_ACCENTS.includes(parsed.accent as ThemeAccent)
        ? (parsed.accent as ThemeAccent)
        : DEFAULT_UI_PREFERENCES.accent,
      sidebarCollapsed: typeof parsed.sidebarCollapsed === 'boolean' ? parsed.sidebarCollapsed : false,
      showPageImages: typeof parsed.showPageImages === 'boolean' ? parsed.showPageImages : true
    };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES, mode: systemMode, modeSource: 'system' };
  }
}

export function saveUiPreferences(prefs: UiPreferences): void {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function applyThemeToDocument(
  prefs: Pick<UiPreferences, 'mode' | 'palette' | 'accent'> & Partial<Pick<UiPreferences, 'showPageImages'>>
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolvedAccent = resolveAccent(prefs.palette, prefs.accent);
  root.setAttribute('data-theme', prefs.mode);
  root.setAttribute('data-palette', prefs.palette);
  root.setAttribute('data-accent', resolvedAccent);
  root.setAttribute('data-accent-pref', prefs.accent);
  root.setAttribute('data-page-images', prefs.showPageImages === false ? 'off' : 'on');
}
