import { Link } from 'react-router-dom';
import { Image, ImageOff, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import styles from './console.module.css';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Popover } from './Popover';
import { Kbd } from './Console';
import { useTheme } from '../../hooks/useTheme';
import type { TableDensity, ThemeAccent, ThemePalette } from '../../lib/prefs';
import { DISPLAY_STRINGS, SHELL_STRINGS, TABLE_STRINGS } from '../../strings/common';
import { STRINGS } from '../../strings/en';

const DENSITIES: readonly TableDensity[] = ['compact', 'default', 'comfortable'];

export interface DisplayMenuProps {
  /** Prefix for test ids so the desktop and mobile copies stay distinct. */
  scope?: 'desktop' | 'mobile';
}

/**
 * One "Display" menu for theme, palette, accent, row height and page photos (DESIGN.md §4).
 * Settings > Display keeps the full controls.
 */
export function DisplayMenu({ scope = 'desktop' }: DisplayMenuProps) {
  const { prefs, setMode, setPalette, setAccent, setTableDensity, toggleShowPageImages } = useTheme();
  const prefix = scope === 'desktop' ? '' : 'mobile-';

  return (
    <Popover
      label={DISPLAY_STRINGS.menuLabel}
      testId={`${prefix}display-menu`}
      renderTrigger={({ ref, ...p }) => (
        <Button
          ref={ref}
          {...p}
          variant="secondary"
          size="sm"
          iconOnly
          aria-label={DISPLAY_STRINGS.menuLabel}
          leftIcon={<SlidersHorizontal size={16} />}
          data-testid={`${prefix}display-menu-btn`}
        />
      )}
    >
      {(close) => (
        <div>
          <div className={styles.settingRow}>
            <span id={`${prefix}display-theme-label`}>{DISPLAY_STRINGS.theme}</span>
            <span className={styles.segmented} role="group" aria-labelledby={`${prefix}display-theme-label`}>
              <button type="button" aria-pressed={prefs.mode === 'light'} onClick={() => setMode('light')}>
                <Sun size={13} aria-hidden="true" /> {DISPLAY_STRINGS.light}
              </button>
              <button type="button" aria-pressed={prefs.mode === 'dark'} onClick={() => setMode('dark')}>
                <Moon size={13} aria-hidden="true" /> {DISPLAY_STRINGS.dark}
              </button>
            </span>
          </div>
          <label className={styles.settingRow}>
            <span>{DISPLAY_STRINGS.palette}</span>
            <select value={prefs.palette} onChange={(e) => setPalette(e.target.value as ThemePalette)}>
              <option value="editorial">{STRINGS.theme.palettes.editorial}</option>
              <option value="obsidian">{STRINGS.theme.palettes.obsidian}</option>
              <option value="emerald">{STRINGS.theme.palettes.emerald}</option>
            </select>
          </label>
          <label className={styles.settingRow}>
            <span>{DISPLAY_STRINGS.accent}</span>
            <select value={prefs.accent} onChange={(e) => setAccent(e.target.value as ThemeAccent)}>
              <option value="auto">{DISPLAY_STRINGS.accentAuto}</option>
              <option value="cobalt">{STRINGS.theme.accents.cobalt}</option>
              <option value="emerald">{STRINGS.theme.accents.emerald}</option>
              <option value="amber">{STRINGS.theme.accents.amber}</option>
              <option value="rose">{STRINGS.theme.accents.rose}</option>
            </select>
          </label>
          <div className={styles.settingRow}>
            <span id={`${prefix}display-density-label`}>{DISPLAY_STRINGS.density}</span>
            <span className={styles.segmented} role="group" aria-labelledby={`${prefix}display-density-label`}>
              {DENSITIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={prefs.tableDensity === d}
                  onClick={() => setTableDensity(d)}
                  data-testid={`${prefix}display-density-${d}`}
                >
                  {TABLE_STRINGS.densities[d]}
                </button>
              ))}
            </span>
          </div>
          <div className={styles.settingRow}>
            <span>{DISPLAY_STRINGS.pagePhotos}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleShowPageImages}
              aria-pressed={prefs.showPageImages}
              aria-label={STRINGS.theme.pageImagesLabel}
              leftIcon={prefs.showPageImages ? <Image size={14} /> : <ImageOff size={14} />}
              data-testid={scope === 'desktop' ? 'user-menu-page-images-toggle' : 'mobile-user-menu-page-images-toggle'}
            >
              {prefs.showPageImages ? DISPLAY_STRINGS.on : DISPLAY_STRINGS.off}
            </Button>
          </div>
          <hr className={styles.menuSeparator} />
          <Link to="/settings" className={styles.menuItem} onClick={close}>
            {DISPLAY_STRINGS.moreSettings}
          </Link>
        </div>
      )}
    </Popover>
  );
}

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={SHELL_STRINGS.shortcutsTitle}>
      <ul className={styles.shortcutList} data-testid="shortcuts-list">
        {SHELL_STRINGS.shortcuts.map((s) => (
          <li key={`${s.keys.join('+')}-${s.label}`} className={styles.shortcutItem}>
            <span>{s.label}</span>
            <Kbd keys={s.keys} />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
