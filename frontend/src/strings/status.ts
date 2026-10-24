/**
 * Status labels shown on badges (DESIGN.md §3.2). Sentence case; internal enum names
 * such as URGENT or WARNING never reach the screen.
 */
export const STATUS_STRINGS = {
  READY: 'Fresh',
  WARNING: 'Expiring',
  URGENT: 'Expiring soon',
  EXPIRED: 'Expired',
  DISPATCHED: 'Dispatched',
  EXCEPTION: 'Missing expiry',
  ON_HOLD: 'On hold',
  PASSED: 'Passed',
  FLAGGED: 'Flagged',
  FAILED: 'Failed',
  NOT_INSPECTED: 'Not inspected',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  active: 'Active',
  inactive: 'Inactive',
  deleted: 'Deleted',
  ARCHIVED: 'Archived'
} as const;

/** Shelf-life rail text (DESIGN.md §4, ShelfLifeRail). */
export const RAIL_STRINGS = {
  daysLeft: (days: number) => (days === 1 ? '1 day left' : `${days} days left`),
  expiresToday: 'Expires today',
  expiredAgo: (days: number) => (days === 1 ? 'Expired 1 day ago' : `Expired ${days} days ago`),
  dispatched: 'Dispatched',
  noExpiry: 'No expiry date',
  ariaLabel: (percentUsed: number, text: string) => `Shelf life ${percentUsed}% used, ${text}`
} as const;
