import { useQuery } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { fetchMyLoginHistory } from '../../api/endpoints';
import type { LoginEventDto } from '../../api/types';
import {
  Checkbox,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  Table,
  type TableColumn
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { formatTimestamp } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';
import type { ThemeAccent, ThemePalette } from '../../lib/prefs';
import { STRINGS } from '../../strings/en';

const loginColumns: TableColumn<LoginEventDto>[] = [
  {
    key: 'createdAt',
    header: 'Signed in',
    render: (row) => <span data-testid="login-history-time">{formatTimestamp(row.createdAt)}</span>
  },
  { key: 'browser', header: 'Browser', render: (row) => <span>{row.browser ?? EMPTY_VALUE}</span> },
  { key: 'os', header: 'Operating system', render: (row) => <span>{row.os ?? EMPTY_VALUE}</span> },
  { key: 'device', header: 'Device', render: (row) => <span>{row.device ?? EMPTY_VALUE}</span> }
];

/**
 * Settings (Phase 9): display preferences saved to the account (usePreferencesSync in AppShell
 * does the saving) and the user's own sign-ins from the last 30 days.
 */
export function SettingsPage() {
  const { prefs, setMode, resetModeToSystem, setPalette, setAccent, setShowPageImages } = useTheme();
  const historyQuery = useQuery({ queryKey: ['auth', 'login-history'], queryFn: fetchMyLoginHistory });

  const modeValue = prefs.modeSource === 'system' ? 'system' : prefs.mode;
  const history = historyQuery.data ?? [];

  return (
    <div className={coreStyles.pageStack} data-testid="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Display settings are saved to your account and follow you to any device you sign in on."
        backdropKey="settings"
        priority
      />

      <div className={coreStyles.twoColumnGrid}>
        <section className={coreStyles.sectionCard} data-testid="settings-display-card">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>Display</h2>
              <p className={coreStyles.sectionSubtitle}>Changes apply straight away and save automatically.</p>
            </div>
          </div>

          <div className={coreStyles.pageStack}>
            <Field label="Theme">
              <Select
                value={modeValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'system') resetModeToSystem();
                  else setMode(v === 'dark' ? 'dark' : 'light');
                }}
                options={[
                  { value: 'system', label: 'Match my device' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' }
                ]}
                data-testid="settings-mode-select"
              />
            </Field>

            <Field label={STRINGS.theme.paletteLabel}>
              <Select
                value={prefs.palette}
                onChange={(e) => setPalette(e.target.value as ThemePalette)}
                options={[
                  { value: 'editorial', label: STRINGS.theme.palettes.editorial },
                  { value: 'obsidian', label: STRINGS.theme.palettes.obsidian },
                  { value: 'emerald', label: STRINGS.theme.palettes.emerald }
                ]}
                data-testid="settings-palette-select"
              />
            </Field>

            <Field label={STRINGS.theme.accentLabel}>
              <Select
                value={prefs.accent}
                onChange={(e) => setAccent(e.target.value as ThemeAccent)}
                options={[
                  { value: 'auto', label: 'Auto (palette default)' },
                  { value: 'cobalt', label: STRINGS.theme.accents.cobalt },
                  { value: 'emerald', label: STRINGS.theme.accents.emerald },
                  { value: 'amber', label: STRINGS.theme.accents.amber },
                  { value: 'rose', label: STRINGS.theme.accents.rose }
                ]}
                data-testid="settings-accent-select"
              />
            </Field>

            <Checkbox
              label="Show page photos"
              checked={prefs.showPageImages}
              onChange={(e) => setShowPageImages(e.target.checked)}
              data-testid="settings-page-images-checkbox"
            />
          </div>
        </section>

        <section className={coreStyles.sectionCard} data-testid="settings-login-history-card">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>Recent sign-ins</h2>
              <p className={coreStyles.sectionSubtitle}>
                Your sign-ins from the last 30 days. If one is not yours, change your password on the
                Profile page and sign out everywhere.
              </p>
            </div>
          </div>
          {historyQuery.isLoading ? (
            <Skeleton label="Loading sign-in history" />
          ) : historyQuery.isError ? (
            <ErrorState
              title="Could not load sign-in history"
              description={historyQuery.error instanceof Error ? historyQuery.error.message : 'Please try again.'}
              onRetry={() => void historyQuery.refetch()}
            />
          ) : (
            <Table
              caption="Recent sign-ins"
              columns={loginColumns}
              data={history}
              rowKey={(row) => row.id ?? `${row.createdAt}`}
              emptyTitle="No sign-ins in the last 30 days"
            />
          )}
        </section>
      </div>
    </div>
  );
}
