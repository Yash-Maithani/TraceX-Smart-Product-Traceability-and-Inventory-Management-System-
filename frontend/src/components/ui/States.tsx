import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, Image, ImageOff, Inbox, Moon, RefreshCw, ShieldAlert, Sun, WifiOff } from 'lucide-react';
import styles from './ui.module.css';
import { Button } from './Button';
import { PageBackdrop } from './PageBackdrop';
import { STRINGS } from '../../strings/en';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeAccent, ThemePalette } from '../../lib/prefs';
import type { BackdropKey } from '../../routes/backdrops';
import { apiRequest } from '../../api/client';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  title = STRINGS.states.emptyDefaultTitle,
  description = STRINGS.states.emptyDefaultBody,
  action
}: EmptyStateProps) {
  return (
    <div className={styles.stateCard} role="status">
      <div className={styles.stateIcon} aria-hidden="true">
        <Inbox size={22} />
      </div>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateDescription}>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string | undefined;
  description?: string | undefined;
  requestId?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export function ErrorState({
  title = STRINGS.states.errorDefaultTitle,
  description = STRINGS.states.errorDefaultBody,
  requestId,
  onRetry
}: ErrorStateProps) {
  return (
    <div className={styles.stateCard} role="alert">
      <div className={`${styles.stateIcon} ${styles.stateIconDanger}`} aria-hidden="true">
        <AlertTriangle size={22} />
      </div>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateDescription}>{description}</p>
      {requestId ? (
        <div className={styles.requestIdTag}>
          {STRINGS.common.requestIdLabel}: {requestId}
        </div>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} leftIcon={<RefreshCw size={15} />}>
          {STRINGS.common.retry}
        </Button>
      ) : null}
    </div>
  );
}

export interface ForbiddenStateProps {
  title?: string;
  description?: string;
  requiredRoles?: string[];
  action?: ReactNode;
}

export function ForbiddenState({
  title = STRINGS.states.forbiddenTitle,
  description = STRINGS.states.forbiddenBody,
  requiredRoles,
  action
}: ForbiddenStateProps) {
  return (
    <div className={styles.stateCard} role="alert" data-testid="forbidden-state">
      <div className={`${styles.stateIcon} ${styles.stateIconDanger}`} aria-hidden="true">
        <ShieldAlert size={22} />
      </div>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateDescription}>
        {description}
        {requiredRoles && requiredRoles.length > 0
          ? ` Required role: ${requiredRoles.join(' or ')}.`
          : ''}
      </p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export interface OfflineBannerProps {
  forceShow?: boolean;
}

export function OfflineBanner({ forceShow = false }: OfflineBannerProps) {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline || forceShow) return;
    const interval = window.setInterval(() => {
      apiRequest('/api/v1/auth/me', {
        method: 'GET',
        skipUnauthorizedRedirect: true
      }).catch(() => {
        // Still offline; apiRequest keeps backendReachable false until a response is received
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, [isOnline, forceShow]);

  if (isOnline && !forceShow) return null;

  return (
    <div className={styles.offlineBanner} role="status" aria-live="polite" data-testid="offline-banner">
      <WifiOff size={16} aria-hidden="true" />
      <span>{STRINGS.common.offlineBanner}</span>
    </div>
  );
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string | undefined;
  breadcrumbs?: BreadcrumbItem[] | undefined;
  actions?: ReactNode;
  backdropKey?: BackdropKey | undefined;
  priority?: boolean | undefined;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  backdropKey,
  priority
}: PageHeaderProps) {
  if (backdropKey) {
    return (
      <header className={styles.pageHeaderWithBackdrop} data-testid="page-header">
        <PageBackdrop backdropKey={backdropKey} variant="banner" priority={priority}>
          <div className={styles.bannerHeaderCopy}>
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb">
                <ol className={`${styles.breadcrumbs} ${styles.bannerBreadcrumbs}`}>
                  {breadcrumbs.map((item, idx) => (
                    <li key={`${item.label}-${idx}`}>
                      {item.label}
                      {idx < breadcrumbs.length - 1 ? ' / ' : ''}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
            <h1 className={styles.bannerTitle}>{title}</h1>
            {subtitle ? <p className={styles.bannerSubtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className={styles.bannerActions}>{actions}</div> : null}
        </PageBackdrop>
      </header>
    );
  }

  return (
    <header className={styles.pageHeader} data-testid="page-header">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className={styles.breadcrumbs}>
              {breadcrumbs.map((item, idx) => (
                <li key={`${item.label}-${idx}`}>
                  {item.label}
                  {idx < breadcrumbs.length - 1 ? ' / ' : ''}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}

export interface PageImagesToggleProps {
  fullWidth?: boolean | undefined;
  testId?: string | undefined;
}

export function PageImagesToggle({ fullWidth = false, testId = 'toggle-page-images' }: PageImagesToggleProps) {
  const { prefs, toggleShowPageImages } = useTheme();
  const isOn = prefs.showPageImages;

  return (
    <Button
      variant="secondary"
      size="sm"
      fullWidth={fullWidth}
      onClick={toggleShowPageImages}
      aria-pressed={isOn}
      aria-label={STRINGS.theme.pageImagesLabel}
      leftIcon={isOn ? <Image size={15} /> : <ImageOff size={15} />}
      data-testid={testId}
    >
      {isOn ? STRINGS.theme.pageImagesOn : STRINGS.theme.pageImagesOff}
    </Button>
  );
}

export interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { prefs, toggleMode, setPalette, setAccent } = useTheme();
  const isDark = prefs.mode === 'dark';

  return (
    <div className={styles.themeControls}>
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleMode}
        aria-label={isDark ? STRINGS.theme.light : STRINGS.theme.dark}
        leftIcon={isDark ? <Sun size={15} /> : <Moon size={15} />}
      >
        {isDark ? STRINGS.theme.light : STRINGS.theme.dark}
      </Button>
      {!compact ? (
        <>
          <label>
            <span className="sr-only">{STRINGS.theme.paletteLabel}</span>
            <select
              aria-label={STRINGS.theme.paletteLabel}
              className={styles.themeSelect}
              value={prefs.palette}
              onChange={(e) => setPalette(e.target.value as ThemePalette)}
            >
              <option value="editorial">{STRINGS.theme.palettes.editorial}</option>
              <option value="obsidian">{STRINGS.theme.palettes.obsidian}</option>
              <option value="emerald">{STRINGS.theme.palettes.emerald}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{STRINGS.theme.accentLabel}</span>
            <select
              aria-label={STRINGS.theme.accentLabel}
              className={styles.themeSelect}
              value={prefs.accent}
              onChange={(e) => setAccent(e.target.value as ThemeAccent)}
            >
              <option value="auto">Auto (Palette Default)</option>
              <option value="cobalt">{STRINGS.theme.accents.cobalt}</option>
              <option value="emerald">{STRINGS.theme.accents.emerald}</option>
              <option value="amber">{STRINGS.theme.accents.amber}</option>
              <option value="rose">{STRINGS.theme.accents.rose}</option>
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}

export interface SkipLinkProps {
  targetId?: string;
}

export function SkipLink({ targetId = 'main-content' }: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className={styles.skipLink}>
      {STRINGS.common.skipToContent}
    </a>
  );
}
