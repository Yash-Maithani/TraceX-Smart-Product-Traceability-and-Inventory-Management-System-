/**
 * Public QR trace page copy for shoppers (redesign R6, AUDIT §3.12). No internal tiers such as
 * "Urgent": the server status is translated into what it means for the person holding the pack.
 */
export const TRACE_STRINGS = {
  verified: 'This is a recorded TraceX batch.',
  batch: (code: string) => `Batch ${code}`,
  bestBefore: 'Best before',
  packed: 'Packed',
  origin: 'From',
  productCode: 'Product code',
  notRecorded: 'Not recorded',
  /** Shopper wording for the server's freshness status. */
  status: {
    READY: 'Fresh',
    WARNING: 'Best used soon',
    URGENT: 'Best used within a few days',
    EXPIRED: 'Past its best-before date',
    DISPATCHED: 'Dispatched to the seller',
    EXCEPTION: 'Best-before date not recorded'
  } as Record<string, string>,
  journeyTitle: 'Where this batch has been',
  journeyLabel: 'Batch journey',
  steps: {
    collected: (village: string) => `Collected from ${village}`,
    collectedUnknown: 'Collected from the farm',
    packed: 'Packed',
    inspected: (verdict: string) => `Quality check: ${verdict}`,
    dispatched: 'Dispatched to the seller'
  },
  verdicts: { PASSED: 'passed', FLAGGED: 'passed with a note', FAILED: 'did not pass' } as Record<string, string>,
  rating: (n: number | undefined) => `Rated ${n ?? 0} of 5`,
  noteTitle: 'Note from TraceX Technologies',
  loading: 'Loading batch details',
  notFoundTitle: 'We could not find this batch',
  notFoundBody: 'This QR link is not valid or the batch is no longer available.',
  errorTitle: 'Could not load this batch',
  errorBody: 'Check your connection and try again.',
  copyright: (year: number) => `Copyright ${year} TraceX Technologies`,
  footerLabel: 'Legal'
} as const;
