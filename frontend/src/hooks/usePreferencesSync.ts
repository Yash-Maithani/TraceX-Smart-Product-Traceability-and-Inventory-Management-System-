import { useEffect, useRef } from 'react';
import { updateMySettings } from '../api/endpoints';
import type { UpdateSettingsDto, UserPreferencesDto } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { logger } from '../lib/logger';
import type { UiPreferences } from '../lib/prefs';
import { useTheme } from './useTheme';

const SAVE_DELAY_MS = 800;

/** The four display settings that follow the user across devices (sidebar state stays local). */
export function toSettingsPayload(prefs: UiPreferences): UpdateSettingsDto {
  return {
    mode: prefs.modeSource === 'system' ? 'system' : prefs.mode,
    palette: prefs.palette,
    accent: prefs.accent,
    showPageImages: prefs.showPageImages
  };
}

function payloadKey(payload: UpdateSettingsDto | UserPreferencesDto): string {
  return JSON.stringify([payload.mode, payload.palette, payload.accent, payload.showPageImages]);
}

/**
 * Keeps display settings in step with the signed-in account (Phase 9, PATCH /api/v1/auth/me/settings).
 * At sign-in the account's saved settings win. If the account has none yet, the current local
 * settings are saved to it. After that, every change is saved shortly after it is made.
 */
export function usePreferencesSync(): void {
  const { user } = useAuth();
  const { prefs, applyAccountPreferences } = useTheme();
  const appliedForUser = useRef<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || appliedForUser.current === user.id) return;
    appliedForUser.current = user.id;
    if (user.preferences) {
      applyAccountPreferences(user.preferences);
      lastSaved.current = payloadKey(user.preferences);
    } else {
      lastSaved.current = null;
    }
  }, [user?.id, user?.preferences, applyAccountPreferences]);

  useEffect(() => {
    if (!user?.id || appliedForUser.current !== user.id) return undefined;
    const payload = toSettingsPayload(prefs);
    const key = payloadKey(payload);
    if (key === lastSaved.current) return undefined;

    const timer = setTimeout(() => {
      updateMySettings(payload)
        .then(() => {
          lastSaved.current = key;
        })
        .catch((err: unknown) => {
          // Settings still apply locally; the next change will try again
          logger.warn('Saving display settings failed', { error: String(err) });
        });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [prefs, user?.id]);
}
