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
  label: {
    heading: "What's inside",
    ingredients: 'Ingredients',
    allergens: 'Allergens',
    noAllergens: 'No allergens declared',
    storage: 'Storage'
  },
  report: {
    heading: 'Something wrong with this pack?',
    intro: 'Tell the quality team. They see your report against this exact batch.',
    open: 'Report a problem',
    category: 'What went wrong',
    categoryPlaceholder: 'Choose one',
    message: 'What happened',
    messageHint: 'At least 10 characters. Say what you noticed and when.',
    contact: 'Phone or email (optional)',
    contactHint: 'Only the quality team sees this, and only to follow up with you.',
    submit: 'Send report',
    cancel: 'Cancel',
    sentTitle: 'Report sent',
    sentBody: 'Thank you. The quality team has been told about this batch.',
    illnessAdvice: 'If you feel unwell, contact a doctor. Keep the pack and its label if you can.',
    failed: 'Could not send your report. Try again.',
    tooMany: 'Too many reports from this device. Try again in an hour.'
  },
  reportCategories: [
    { value: 'TASTE_OR_SMELL', label: 'Taste or smell' },
    { value: 'PACKAGING', label: 'Damaged packaging' },
    { value: 'FOREIGN_OBJECT', label: 'Something in the product' },
    { value: 'ILLNESS', label: 'Felt unwell after eating' },
    { value: 'EXPIRY', label: 'Date or freshness' },
    { value: 'OTHER', label: 'Other' }
  ],
  loading: 'Loading batch details',
  notFoundTitle: 'We could not find this batch',
  notFoundBody: 'This QR link is not valid or the batch is no longer available.',
  errorTitle: 'Could not load this batch',
  errorBody: 'Check your connection and try again.',
  copyright: (year: number) => `Copyright ${year} TraceX Technologies`,
  footerLabel: 'Legal'
} as const;
