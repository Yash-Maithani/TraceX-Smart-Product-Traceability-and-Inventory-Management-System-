import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import styles from './console.module.css';
import { Popover } from './Popover';
import { useLiveStatus } from '../../lib/liveStatus';
import { formatTimestamp } from '../../lib/dates';
import { LIVE_STRINGS } from '../../strings/common';

/* ---------- Kbd ---------- */

export function Kbd({ keys }: { keys: readonly string[] }) {
  return (
    <span className={styles.kbdRow}>
      {keys.map((k) => (
        <kbd key={k} className={styles.kbd}>
          {k}
        </kbd>
      ))}
    </span>
  );
}

/* ---------- StatCard (real data only) ---------- */

export type StatTone = 'danger' | 'urgent' | 'warning' | 'hold' | 'info' | 'success';

const STAT_TONE_CLASS: Record<StatTone, string> = {
  danger: styles.statToneDanger ?? '',
  urgent: styles.statToneUrgent ?? '',
  warning: styles.statToneWarning ?? '',
  hold: styles.statToneHold ?? '',
  info: styles.statToneInfo ?? '',
  success: styles.statToneSuccess ?? ''
};

export interface StatCardProps {
  label: string;
  /** From the API. null or undefined renders a dash and `unavailableText`; never a made-up number. */
  value: number | null | undefined;
  context?: string | undefined;
  icon?: ReactNode;
  /** Status colour shown only while the value is above zero. */
  tone?: StatTone | undefined;
  to?: string | undefined;
  unavailableText?: string | undefined;
  testId?: string | undefined;
  valueTestId?: string | undefined;
}

export function StatCard({
  label,
  value,
  context,
  icon,
  tone,
  to,
  unavailableText = 'Not available',
  testId,
  valueTestId
}: StatCardProps) {
  const hasValue = typeof value === 'number';
  const toneClass = hasValue && value > 0 && tone ? STAT_TONE_CLASS[tone] : '';
  const body = (
    <>
      <span className={styles.statLabel}>
        {icon}
        {label}
      </span>
      <span className={styles.statValue} data-testid={valueTestId}>
        {hasValue ? value : '-'}
      </span>
      <span className={styles.statContext}>{hasValue ? context : unavailableText}</span>
    </>
  );
  const className = `${styles.statCard} ${toneClass}`.trim();
  return to ? (
    <Link to={to} className={className} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div className={className} data-testid={testId}>
      {body}
    </div>
  );
}

/* ---------- Tabs (ARIA tabs, arrow keys, Home/End) ---------- */

export interface TabItem {
  id: string;
  label: string;
  count?: number | undefined;
  testId?: string | undefined;
}

export interface TabsProps {
  label: string;
  tabs: TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** id prefix for aria-controls; the panel must use `${idPrefix}-panel-${id}`. */
  idPrefix: string;
}

export function Tabs({ label, tabs, selectedId, onSelect, idPrefix }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = tabs.findIndex((t) => t.id === selectedId);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onSelect(tab.id);
    refs.current[tab.id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={styles.tabList}>
      {tabs.map((t) => {
        const selected = t.id === selectedId;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(t.id)}
            onKeyDown={move}
            data-testid={t.testId}
          >
            {t.label}
            {typeof t.count === 'number' ? <span className={styles.tabCount}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Timeline ---------- */

export type TimelineTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TIMELINE_TONE_CLASS: Record<TimelineTone, string> = {
  neutral: '',
  success: styles.timelineBadgeSuccess ?? '',
  warning: styles.timelineBadgeWarning ?? '',
  danger: styles.timelineBadgeDanger ?? '',
  info: styles.timelineBadgeInfo ?? ''
};

export interface TimelineEntry {
  id: string;
  icon: ReactNode;
  /** Icon meaning for screen readers, e.g. "Inspection passed". */
  iconLabel: string;
  title: ReactNode;
  time?: string | undefined;
  body?: ReactNode;
  tone?: TimelineTone | undefined;
  condensed?: boolean | undefined;
}

export function Timeline({ entries, label, testId }: { entries: TimelineEntry[]; label: string; testId?: string }) {
  return (
    <ol className={styles.timeline} aria-label={label} data-testid={testId}>
      {entries.map((e) => (
        <li key={e.id} className={`${styles.timelineItem} ${e.condensed ? styles.timelineCondensed : ''}`}>
          <span
            className={`${styles.timelineBadge} ${TIMELINE_TONE_CLASS[e.tone ?? 'neutral']}`}
            role="img"
            aria-label={e.iconLabel}
          >
            {e.icon}
          </span>
          <div>
            <div className={styles.timelineHead}>
              <span className={styles.timelineTitle}>{e.title}</span>
              {e.time ? <span className={styles.timelineTime}>{e.time}</span> : null}
            </div>
            {e.body ? <div className={styles.timelineBody}>{e.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- FilterChip (Stripe-style: suggested chip opens a menu, active chip clears) ---------- */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterChipProps {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  testId?: string | undefined;
  clearLabel?: (label: string) => string;
}

export function FilterChip({
  label,
  value,
  options,
  onChange,
  testId,
  clearLabel = (l) => `Clear ${l.toLowerCase()} filter`
}: FilterChipProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <span className={styles.chipGroup}>
      <Popover
        label={label}
        align="start"
        testId={testId ? `${testId}-menu` : undefined}
        renderTrigger={({ ref, ...p }) => (
          <button
            ref={ref}
            type="button"
            {...p}
            className={`${styles.chip} ${selected ? styles.chipActive : ''}`}
            data-testid={testId}
          >
            {selected ? null : <Plus size={14} aria-hidden="true" />}
            <span>{label}</span>
            {selected ? <span className={styles.chipValue}>{selected.label}</span> : null}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
      >
        {(close) => (
          <ul className={styles.menuList}>
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`${styles.menuItem} ${o.value === value ? styles.menuItemSelected : ''}`}
                  aria-pressed={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                >
                  {o.label}
                  {o.value === value ? <Check size={14} className={styles.menuItemCheck} aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
      {selected ? (
        <button
          type="button"
          className={styles.chipClear}
          aria-label={clearLabel(label)}
          onClick={() => onChange('')}
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

/* ---------- LiveIndicator ---------- */

const LIVE_CLASS = {
  live: styles.liveStateLive,
  connecting: styles.liveStateConnecting,
  reconnecting: styles.liveStateReconnecting,
  offline: ''
} as const;

export function LiveIndicator() {
  const { state, lastEventAt } = useLiveStatus();
  const label = LIVE_STRINGS[state];
  const help =
    state === 'live'
      ? LIVE_STRINGS.liveHelp
      : state === 'offline'
        ? LIVE_STRINGS.offlineHelp
        : LIVE_STRINGS.reconnectingHelp;
  const last = lastEventAt ? LIVE_STRINGS.lastUpdate(formatTimestamp(lastEventAt)) : LIVE_STRINGS.noUpdatesYet;
  return (
    <span
      className={`${styles.live} ${LIVE_CLASS[state] ?? ''}`}
      title={`${help} ${last}`}
      data-testid="live-indicator"
      data-state={state}
    >
      <span className={styles.liveDot} aria-hidden="true" />
      <span role="status" aria-live="polite" className={styles.liveLabel}>
        {label}
      </span>
      <span className="sr-only">{`${help} ${last}`}</span>
    </span>
  );
}
