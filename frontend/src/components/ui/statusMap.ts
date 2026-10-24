import {
  AlarmClock,
  Archive,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Lock,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  Truck
} from 'lucide-react';
import styles from './ui.module.css';
import { STATUS_STRINGS } from '../../strings/status';
import type {
  AccessRequestStatus,
  AccountStatus,
  BatchStatusTier,
  InspectionVerdict
} from '../../types/domain';

/** ON_HOLD is derived in the browser from a FAILED latest inspection (D-19), never sent by the API. */
export type StatusBadgeValue =
  | BatchStatusTier
  | InspectionVerdict
  | AccessRequestStatus
  | AccountStatus
  | 'ON_HOLD';

export interface BadgeVisualConfig {
  label: string;
  toneClass: string;
  Icon: typeof CircleCheck;
  /** Strong (filled) badges are kept for states that stop work: Expired and On hold. */
  strong?: boolean;
}

export const STATUS_BADGE_MAP: Record<StatusBadgeValue, BadgeVisualConfig> = {
  // Batch freshness tiers & lifecycle (DESIGN.md §3.2)
  READY: {
    label: STATUS_STRINGS.READY,
    toneClass: styles.badgeSuccess ?? '',
    Icon: CircleCheck
  },
  WARNING: {
    label: STATUS_STRINGS.WARNING,
    toneClass: styles.badgeWarning ?? '',
    Icon: Clock
  },
  URGENT: {
    label: STATUS_STRINGS.URGENT,
    toneClass: styles.badgeUrgent ?? '',
    Icon: AlarmClock
  },
  EXPIRED: {
    label: STATUS_STRINGS.EXPIRED,
    toneClass: styles.badgeDangerStrong ?? '',
    Icon: CircleX,
    strong: true
  },
  ON_HOLD: {
    label: STATUS_STRINGS.ON_HOLD,
    toneClass: styles.badgeHold ?? '',
    Icon: Lock,
    strong: true
  },
  DISPATCHED: {
    label: STATUS_STRINGS.DISPATCHED,
    toneClass: styles.badgeInfo ?? '',
    Icon: Truck
  },
  EXCEPTION: {
    label: STATUS_STRINGS.EXCEPTION,
    toneClass: `${styles.badgeNeutral ?? ''} ${styles.badgeDashed ?? ''}`,
    Icon: CircleHelp
  },

  // Inspection verdicts
  PASSED: {
    label: STATUS_STRINGS.PASSED,
    toneClass: styles.badgeSuccess ?? '',
    Icon: ShieldCheck
  },
  FLAGGED: {
    label: STATUS_STRINGS.FLAGGED,
    toneClass: styles.badgeWarning ?? '',
    Icon: ShieldAlert
  },
  FAILED: {
    label: STATUS_STRINGS.FAILED,
    toneClass: styles.badgeDanger ?? '',
    Icon: ShieldX
  },

  // Access request statuses
  pending: {
    label: STATUS_STRINGS.pending,
    toneClass: styles.badgeWarning ?? '',
    Icon: Clock
  },
  approved: {
    label: STATUS_STRINGS.approved,
    toneClass: styles.badgeSuccess ?? '',
    Icon: CircleCheck
  },
  rejected: {
    label: STATUS_STRINGS.rejected,
    toneClass: styles.badgeDanger ?? '',
    Icon: CircleX
  },

  // Account statuses (lowercase + uppercase aliases)
  active: {
    label: STATUS_STRINGS.active,
    toneClass: styles.badgeSuccess ?? '',
    Icon: CircleCheck
  },
  inactive: {
    label: STATUS_STRINGS.inactive,
    toneClass: styles.badgeDanger ?? '',
    Icon: CircleX
  },
  deleted: {
    label: STATUS_STRINGS.deleted,
    toneClass: styles.badgeNeutral ?? '',
    Icon: Trash2
  },
  ACTIVE: {
    label: STATUS_STRINGS.active,
    toneClass: styles.badgeSuccess ?? '',
    Icon: CircleCheck
  },
  INACTIVE: {
    label: STATUS_STRINGS.inactive,
    toneClass: styles.badgeDanger ?? '',
    Icon: CircleX
  },
  ARCHIVED: {
    label: STATUS_STRINGS.ARCHIVED,
    toneClass: styles.badgeNeutral ?? '',
    Icon: Archive
  }
};

/** A batch is on hold when its latest inspection failed (server rule QUALITY_HOLD, D-19). */
export function isOnHold(batch: { qualityCheck?: { status?: string | null } | null }): boolean {
  return batch.qualityCheck?.status === 'FAILED';
}
