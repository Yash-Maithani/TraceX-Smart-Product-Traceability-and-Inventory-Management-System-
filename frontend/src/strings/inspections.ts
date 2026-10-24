/** Quality inspections copy (redesign R5, DESIGN.md §5 and §6.7). */
export const INSPECTION_STRINGS = {
  title: 'Inspections',
  subtitle: 'Quality checks on each batch. Every inspection is kept permanently.',
  count: (n: number) => (n === 1 ? '1 inspection' : `${n} inspections`),
  record: 'Record inspection',
  tabsLabel: 'Inspection lists',
  tabs: {
    all: 'Latest per batch',
    mine: 'Recorded by me'
  },
  filtersLabel: 'Inspection filters',
  verdictFilter: 'Verdict',
  dateFilter: 'Recorded',
  dateFrom: 'Recorded on or after',
  dateTo: 'Recorded on or before',
  clearFilters: 'Clear filters',
  caption: 'Inspections',
  columns: {
    batch: 'Batch',
    verdict: 'Verdict',
    rating: 'Rating',
    inspector: 'Inspector',
    recorded: 'Recorded',
    action: 'Record'
  },
  rating: (n: number | undefined) => `${n ?? 0} of 5`,
  view: 'View',
  viewLabel: (code: string) => `View inspection of ${code}`,
  emptyTitle: 'No inspections yet',
  emptyCanRecord: 'Record one from here or from a batch page.',
  emptyCannotRecord: 'Quality inspectors record inspections. They will show up here.',
  emptyMineTitle: 'You have not recorded any inspections',
  emptyMineBody: 'Inspections you record will show up here.',
  emptyNoMatchTitle: 'No inspections match these filters',
  emptyNoMatchBody: 'Clear the filters to see every inspection.',
  errorTitle: 'Could not load inspections',
  errorBody: 'Check your connection and try again.',
  loading: 'Loading inspections',
  /* Record dialog */
  dialog: {
    title: 'Record inspection',
    description: 'Inspections are kept permanently and cannot be edited later.',
    batch: 'Batch',
    batchPlaceholder: 'Choose a batch',
    verdict: 'Verdict',
    verdicts: {
      PASSED: 'Passed: cleared for dispatch',
      FLAGGED: 'Flagged: can ship with a quality note',
      FAILED: 'Failed: the batch goes on hold'
    },
    rating: 'Rating',
    ratings: {
      '5': '5: Excellent',
      '4': '4: Good',
      '3': '3: Acceptable',
      '2': '2: Below standard',
      '1': '1: Unacceptable'
    } as Record<string, string>,
    checklist: 'Checklist',
    checklistHint: 'Mark each check. Notes are optional, up to 200 characters.',
    pass: 'Pass',
    fail: 'Fail',
    notChecked: 'Not checked',
    noteLabel: (label: string) => `Note for ${label}`,
    notePlaceholder: 'Optional note',
    guard: 'A Passed verdict needs every checked item to pass. Change the verdict or the failing checks.',
    findings: 'Findings',
    findingsPlaceholder: 'What you saw or measured',
    recommendation: 'Recommendation',
    recommendationPlaceholder: 'What should happen to this batch',
    cancel: 'Cancel',
    submit: 'Save inspection',
    successTitle: 'Inspection recorded',
    successBody: (verdict: string, code: string) => `${verdict} recorded for ${code}.`,
    failed: 'Could not save the inspection.'
  },
  /* Read-only detail */
  detail: {
    title: (code: string) => `Inspection of ${code}`,
    description: 'Inspections cannot be changed or deleted after they are saved.',
    verdict: 'Verdict',
    rating: 'Rating',
    inspector: 'Inspector',
    recorded: 'Recorded',
    findings: 'Findings',
    recommendation: 'Recommendation',
    checklist: 'Checklist',
    comments: 'Comments',
    close: 'Close'
  }
} as const;
