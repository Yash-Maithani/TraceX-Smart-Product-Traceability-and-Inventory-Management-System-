/** Dashboard copy (DESIGN.md §5, §6.2). The page answers: what needs action today, and what ships next. */
export const DASHBOARD_STRINGS = {
  title: 'Today',
  asOf: (date: string) => `Stock as of ${date}`,
  asOfPending: 'Stock, inspections and the dispatch queue',
  signedInAs: 'Signed in as',
  refresh: 'Refresh',
  createBatch: 'Create batch',
  openQueue: 'Open dispatch queue',
  needsActionHeading: 'Needs action',
  needsActionLabel: 'Batches and requests that need action today',
  tiles: {
    expired: { label: 'Expired', context: 'Cannot be dispatched. Archive or correct them.' },
    urgent: { label: 'Expiring in 7 days', context: 'Dispatch these first.' },
    hold: { label: 'On hold', context: 'Latest inspection failed. Re-inspect to release.' },
    requests: { label: 'Access requests', context: 'Waiting for an administrator.' },
    dispatchedToday: { label: 'Dispatched today', context: (total: number) => `${total} dispatched in all` }
  },
  stockHeading: 'Stock by freshness',
  stockLabel: (active: number) => `${active} active ${active === 1 ? 'batch' : 'batches'} by freshness`,
  stockActive: (active: number) => `${active} active ${active === 1 ? 'batch' : 'batches'}`,
  stockDispatched: (n: number) => `${n} dispatched`,
  nextHeading: 'Next to dispatch',
  nextSubtitle: 'The five batches the dispatch queue will ship first.',
  nextEmpty: 'Nothing to dispatch. All active batches are expired or already shipped.',
  openQueueShort: 'Open queue',
  quantity: (qty: number | undefined, unit: string | undefined) => `${qty ?? 0} ${unit ?? ''}`.trim(),
  inspectionsHeading: 'Latest inspections',
  inspectionsSubtitle: 'Verdict of the latest inspection on each batch.',
  openInspections: 'Open inspections',
  verdicts: {
    PASSED: 'Passed',
    FLAGGED: 'Flagged',
    FAILED: 'Failed (on hold)',
    none: 'Not inspected'
  },
  emptyTitle: 'No batches yet',
  emptyCanCreate: 'Create the first batch to start tracking freshness and the dispatch queue.',
  emptyCannotCreate: 'A factory manager or an administrator creates batches. They will show up here.',
  errorTitle: "Could not load today's summary",
  errorBody: 'Check your connection and try again.',
  loading: 'Loading dashboard summary'
} as const;
