import type { CSSProperties } from 'react';
import styles from './console.module.css';
import { RAIL_STRINGS } from '../../strings/status';
import type { StatusBadgeValue } from './statusMap';

export interface ShelfLifeRailProps {
  packDate?: string | null | undefined;
  expiryDate?: string | null | undefined;
  /** Server-computed days until expiry (business time zone). Without it the rail shows no days. */
  daysUntilExpiry?: number | null | undefined;
  status?: StatusBadgeValue | string | null | undefined;
  testId?: string | undefined;
}

const DAY_MS = 86_400_000;

function parseDateOnly(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d);
  return Number.isNaN(t) ? null : t;
}

const TONE_BY_STATUS: Record<string, RailModel['tone']> = {
  READY: 'success',
  WARNING: 'warning',
  URGENT: 'urgent',
  EXPIRED: 'danger',
  EXCEPTION: 'neutral'
};

export interface RailModel {
  percentUsed: number;
  text: string;
  tone: 'success' | 'warning' | 'urgent' | 'danger' | 'neutral';
  strong: boolean;
}

/** Pure model so it can be unit tested without rendering. Shelf life runs from pack date to expiry. */
export function computeRail({
  packDate,
  expiryDate,
  daysUntilExpiry,
  status
}: Omit<ShelfLifeRailProps, 'testId'>): RailModel | null {
  if (status === 'DISPATCHED') return null;
  const pack = parseDateOnly(packDate);
  const expiry = parseDateOnly(expiryDate);
  if (expiry === null || pack === null) {
    return { percentUsed: 0, text: RAIL_STRINGS.noExpiry, tone: 'neutral', strong: false };
  }
  // Days left always come from the server (business time zone); the browser only draws them.
  // (type check only; no threshold is compared here)
  const daysLeft = daysUntilExpiry ?? null;
  if (typeof daysLeft !== 'number') {
    return { percentUsed: 0, text: RAIL_STRINGS.noExpiry, tone: 'neutral', strong: false };
  }
  const totalDays = Math.max(1, Math.round((expiry - pack) / DAY_MS));
  const used = Math.min(totalDays, Math.max(0, totalDays - daysLeft));
  const percentUsed = Math.round((used / totalDays) * 100);

  // Wording and colour follow the server's status tier (D-16); no thresholds are computed here.
  let text: string;
  if (status === 'EXPIRED') text = RAIL_STRINGS.expiredAgo(Math.abs(daysLeft));
  else if (daysLeft === 0) text = RAIL_STRINGS.expiresToday;
  else text = RAIL_STRINGS.daysLeft(daysLeft);

  const tone = TONE_BY_STATUS[String(status)] ?? 'neutral';

  return { percentUsed, text, tone, strong: tone === 'danger' || tone === 'urgent' };
}

const TONE_CLASS: Record<RailModel['tone'], string> = {
  success: styles.railToneSuccess ?? '',
  warning: styles.railToneWarning ?? '',
  urgent: styles.railToneUrgent ?? '',
  danger: styles.railToneDanger ?? '',
  neutral: styles.railToneNeutral ?? ''
};

/**
 * The shelf-life rail (DESIGN.md §1): how much of a batch's shelf life is used, from pack date to
 * expiry, with the days left in tabular figures. Hidden for dispatched batches.
 */
export function ShelfLifeRail({ testId, ...props }: ShelfLifeRailProps) {
  const model = computeRail(props);
  if (!model) {
    return <span className={styles.railText}>{RAIL_STRINGS.dispatched}</span>;
  }
  // Only a CSS custom property is set inline (SPEC §5.2 rule 2); the width rule lives in CSS.
  const fillStyle = { '--rail-width': `${model.percentUsed}%` } as CSSProperties;
  return (
    <span
      className={styles.rail}
      role="img"
      aria-label={RAIL_STRINGS.ariaLabel(model.percentUsed, model.text)}
      data-testid={testId}
    >
      <span className={styles.railTrack} aria-hidden="true">
        <span
          className={`${styles.railFill} ${TONE_CLASS[model.tone]}`}
          style={fillStyle}
        />
      </span>
      <span className={`${styles.railText} ${model.strong ? styles.railTextStrong : ''}`} aria-hidden="true">
        {model.text}
      </span>
    </span>
  );
}
