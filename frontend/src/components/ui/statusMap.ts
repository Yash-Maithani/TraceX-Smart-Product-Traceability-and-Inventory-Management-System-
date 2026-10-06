import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  HelpCircle,
  Trash2,
  Truck,
  XCircle
} from 'lucide-react';
import styles from './ui.module.css';
import type {
  AccessRequestStatus,
  AccountStatus,
  BatchStatusTier,
  InspectionVerdict
} from '../../types/domain';

export type StatusBadgeValue =
  | BatchStatusTier
  | InspectionVerdict
  | AccessRequestStatus
  | AccountStatus;

export interface BadgeVisualConfig {
  label: string;
  toneClass: string;
  Icon: typeof CheckCircle2;
}

export const STATUS_BADGE_MAP: Record<StatusBadgeValue, BadgeVisualConfig> = {
  // Batch freshness tiers & lifecycle
  READY: {
    label: 'Ready',
    toneClass: styles.badgeSuccess ?? '',
    Icon: CheckCircle2
  },
  WARNING: {
    label: 'Warning',
    toneClass: styles.badgeWarning ?? '',
    Icon: AlertTriangle
  },
  URGENT: {
    label: 'Urgent',
    toneClass: styles.badgeUrgent ?? '',
    Icon: AlertCircle
  },
  EXPIRED: {
    label: 'Expired',
    toneClass: styles.badgeDanger ?? '',
    Icon: AlertOctagon
  },
  DISPATCHED: {
    label: 'Dispatched',
    toneClass: styles.badgeInfo ?? '',
    Icon: Truck
  },
  EXCEPTION: {
    label: 'Exception',
    toneClass: styles.badgeNeutral ?? '',
    Icon: HelpCircle
  },

  // Inspection verdicts
  PASSED: {
    label: 'Passed',
    toneClass: styles.badgeSuccess ?? '',
    Icon: CheckCircle2
  },
  FLAGGED: {
    label: 'Flagged',
    toneClass: styles.badgeWarning ?? '',
    Icon: AlertTriangle
  },
  FAILED: {
    label: 'Failed',
    toneClass: styles.badgeDanger ?? '',
    Icon: XCircle
  },

  // Access request statuses
  pending: {
    label: 'Pending',
    toneClass: styles.badgeWarning ?? '',
    Icon: Clock
  },
  approved: {
    label: 'Approved',
    toneClass: styles.badgeSuccess ?? '',
    Icon: CheckCircle2
  },
  rejected: {
    label: 'Rejected',
    toneClass: styles.badgeDanger ?? '',
    Icon: XCircle
  },

  // Account statuses (lowercase + uppercase aliases)
  active: {
    label: 'Active',
    toneClass: styles.badgeSuccess ?? '',
    Icon: CheckCircle2
  },
  inactive: {
    label: 'Inactive',
    toneClass: styles.badgeDanger ?? '',
    Icon: XCircle
  },
  deleted: {
    label: 'Deleted',
    toneClass: styles.badgeNeutral ?? '',
    Icon: Trash2
  },
  ACTIVE: {
    label: 'Active',
    toneClass: styles.badgeSuccess ?? '',
    Icon: CheckCircle2
  },
  INACTIVE: {
    label: 'Inactive',
    toneClass: styles.badgeDanger ?? '',
    Icon: XCircle
  },
  ARCHIVED: {
    label: 'Archived',
    toneClass: styles.badgeNeutral ?? '',
    Icon: Archive
  }
};
