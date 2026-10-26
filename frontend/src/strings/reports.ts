import { TRACE_STRINGS } from './trace';

/** Staff copy for shopper problem reports on the batch detail page (pick-list #2). */
export const REPORT_STRINGS = {
  heading: 'Shopper reports',
  subtitle: 'Problems shoppers reported from this batch\'s QR page.',
  loading: 'Loading shopper reports',
  loadFailed: 'Could not load shopper reports',
  emptyTitle: 'No shopper reports',
  emptyBody: 'Reports sent from the QR page for this batch appear here.',
  open: 'Open',
  resolved: 'Resolved',
  openCount: (n: number) => (n === 1 ? '1 open' : `${n} open`),
  contact: 'Contact',
  noContact: 'No contact left',
  resolvedBy: (name: string, when: string) => `Resolved by ${name}, ${when}`,
  resolve: 'Mark resolved',
  resolveTitle: 'Resolve shopper report',
  resolveDescription: 'Say what you checked or did. The note stays with the report.',
  note: 'Resolution note (optional)',
  confirm: 'Mark resolved',
  cancel: 'Cancel',
  resolvedToast: 'Report marked resolved',
  resolveFailed: 'Could not resolve this report.',
  categoryLabel: (value: string | undefined): string =>
    TRACE_STRINGS.reportCategories.find((c) => c.value === value)?.label ?? value ?? 'Other'
} as const;
