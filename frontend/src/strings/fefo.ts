/** Dispatch queue and dispatch dialog copy (redesign R5, DESIGN.md §5 and §6.6). */
export const FEFO_STRINGS = {
  title: 'Dispatch queue',
  subtitle: 'Ship the batch that expires first. The order comes from the expiry dates, not from this page.',
  summary: (ready: number, expired: number, missing: number) =>
    `${ready} ready, ${expired} expired, ${missing} missing an expiry date`,
  tabsLabel: 'Dispatch queue lists',
  tabs: {
    queue: 'Ready to ship',
    expired: 'Expired',
    missing: 'Missing expiry'
  },
  filtersLabel: 'Dispatch queue filters',
  categoryFilter: 'Category',
  productFilter: 'Product',
  clearFilters: 'Clear filters',
  caption: 'Batches ready to ship, earliest expiry first',
  columns: {
    order: 'Order',
    batch: 'Batch',
    shelfLife: 'Shelf life',
    stock: 'In stock',
    expires: 'Expires',
    quality: 'Quality',
    action: 'Dispatch'
  },
  /** Stock left on a batch; after a partial dispatch it reads "80 of 120 Units". */
  stock: (remaining: number, produced: number, unit: string | undefined) =>
    remaining < produced ? `${remaining} of ${produced} ${unit ?? ''}`.trim() : `${produced} ${unit ?? ''}`.trim(),
  orderLabel: (rank: number) => `Position ${rank} in the queue`,
  nextForProduct: 'Next for this product',
  notInspected: 'Not inspected',
  dispatch: 'Dispatch',
  dispatchBatch: (code: string) => `Dispatch ${code}`,
  viewOnly: 'View only',
  onHold: 'On hold',
  onHoldReason: 'Latest inspection failed. Record a new inspection to release it.',
  emptyQueueTitle: 'Nothing to dispatch',
  emptyQueueBody: 'All active batches are expired, missing an expiry date or already shipped.',
  emptyNoMatchTitle: 'No batches match these filters',
  emptyNoMatchBody: 'Clear the filters to see the whole queue.',
  expiredIntro: 'These batches are past their expiry date and cannot be shipped. Archive them or correct the dates.',
  expiredEmpty: 'No expired batches.',
  missingIntro:
    'These batches have no usable expiry date, so they are kept out of the queue. Open a batch and use Correct details to fix it.',
  missingEmpty: 'Every active batch has an expiry date.',
  missingReason: 'Problem',
  missingReasonFallback: 'Expiry date missing or not a date',
  errorTitle: 'Could not load the dispatch queue',
  errorBody: 'Check your connection and try again.',
  loading: 'Loading the dispatch queue',
  warningTitle: 'Dispatched with a quality note',
  /* Dispatch dialog */
  dialog: {
    title: (code: string) => `Dispatch ${code}`,
    titleOutOfOrder: (code: string) => `Dispatch ${code} out of order?`,
    summary: (expires: string, left: string, quality: string) => `Expires ${expires} (${left}). Quality: ${quality}.`,
    flagged: 'The latest inspection flagged a concern. You can still dispatch it, and TraceX records a quality note with the dispatch.',
    buyer: 'Buyer',
    buyerPlaceholder: 'Buyer or company name',
    buyerRequired: 'Enter the buyer.',
    quantity: 'Quantity to ship',
    quantityHint: (remaining: number, unit: string) =>
      `${remaining} ${unit} in stock. Ship less to keep the rest in the queue.`,
    quantityInvalid: (remaining: number) => `Enter a whole number from 1 to ${remaining}.`,
    date: 'Dispatch date',
    dateHint: 'Leave blank to use today.',
    overrideReason: 'Reason for shipping out of order',
    overrideHint: 'Saved in the audit log.',
    overrideRequired: 'Give a reason for shipping this batch first.',
    overridePlaceholder: 'For example: the buyer asked for this lot',
    cancel: 'Cancel',
    confirm: 'Dispatch batch',
    confirmWithReason: 'Dispatch with reason',
    errors: {
      DISPATCH_OUT_OF_ORDER: 'Another batch of this product expires sooner',
      QUALITY_HOLD: 'This batch is on hold',
      BATCH_EXPIRED: 'This batch has expired',
      ALREADY_DISPATCHED: 'This batch was already dispatched',
      CONFLICT: 'This batch changed while you were working',
      fallback: 'Could not dispatch the batch'
    } as Record<string, string>,
    outOfOrderBody: (earlier: string, code: string, sku: string) =>
      `${earlier} (${sku}) expires before ${code}. Dispatch ${earlier} first, or give a reason to ship this one now.`,
    holdBody: 'Its latest inspection failed. Record a new inspection to release it.',
    expiredBody: 'An expired batch cannot be shipped.',
    successTitle: 'Batch dispatched',
    successBody: (code: string, buyer: string) => `${code} dispatched to ${buyer}.`,
    partialTitle: 'Part of the batch dispatched',
    partialBody: (qty: number, unit: string, code: string, buyer: string, left: number) =>
      `${qty} ${unit} of ${code} dispatched to ${buyer}. ${left} ${unit} stay in the queue.`,
    warningTitle: 'Batch dispatched with a quality note'
  },
  blocked: {
    onHold: 'On hold: latest inspection failed.',
    expired: 'Expired: cannot be dispatched.'
  }
} as const;
