/**
 * Shared copy for tables, the app shell and the new R1 components (DESIGN.md §5).
 * Plain verbs, sentence case, no em dashes.
 */
export const TABLE_STRINGS = {
  emptyTitle: 'Nothing here yet',
  emptyDescription: 'No records match. Clear the filters or add a new record.',
  loadingRow: 'Loading row',
  loading: (caption: string) => `Loading ${caption.toLowerCase()}`,
  paginationLabel: 'Pagination',
  showing: 'Showing',
  to: 'to',
  of: 'of',
  rowsPerPage: 'Rows per page',
  perPage: (n: number) => `${n} per page`,
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
  previous: 'Previous',
  next: 'Next',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  density: 'Row height',
  densities: {
    compact: 'Compact',
    default: 'Default',
    comfortable: 'Comfortable'
  }
} as const;

export const SHELL_STRINGS = {
  navGroups: {
    operations: 'Operations',
    team: 'Team and account'
  },
  search: 'Search',
  searchHint: 'Search pages and batches (Ctrl K)',
  userMenu: (name: string) => `Account menu for ${name}`,
  profile: 'Profile',
  settings: 'Settings',
  privacy: 'Privacy Policy',
  terms: 'Terms and Conditions',
  legalNavLabel: 'Legal',
  signOutAllTitle: 'Sign out on every device?',
  signOutAllBody:
    'Every browser signed in to your account, including this one, is signed out now. You will need your password to sign in again.',
  shortcutsTitle: 'Keyboard shortcuts',
  shortcutsOpen: 'Show keyboard shortcuts',
  shortcuts: [
    { keys: ['Ctrl', 'K'], label: 'Search pages and batches' },
    { keys: ['/'], label: 'Search pages and batches' },
    { keys: ['?'], label: 'Show this list' },
    { keys: ['G', 'D'], label: 'Go to the dashboard' },
    { keys: ['G', 'B'], label: 'Go to batches' },
    { keys: ['G', 'F'], label: 'Go to the dispatch queue' },
    { keys: ['G', 'I'], label: 'Go to inspections' },
    { keys: ['Esc'], label: 'Close a dialog or menu' }
  ]
} as const;

export const DISPLAY_STRINGS = {
  menuLabel: 'Display settings',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  palette: 'Color palette',
  accent: 'Accent color',
  accentAuto: 'Match palette',
  pagePhotos: 'Page photos',
  on: 'On',
  off: 'Off',
  density: TABLE_STRINGS.density,
  moreSettings: 'All display settings'
} as const;

export const LIVE_STRINGS = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  liveHelp: 'Updates arrive without reloading.',
  reconnectingHelp: 'The live connection dropped. Trying again.',
  offlineHelp: 'No live updates. Reload the page to see new changes.',
  lastUpdate: (time: string) => `Last update ${time}.`,
  noUpdatesYet: 'No updates yet.'
} as const;

export const PALETTE_STRINGS = {
  dialogLabel: 'Search pages and batches',
  inputLabel: 'Search',
  placeholder: 'Type a page name or a batch code',
  groups: {
    pages: 'Pages',
    actions: 'Actions',
    batches: 'Batches',
    ask: 'Ask TraceX'
  },
  searching: 'Searching batches',
  noResults: 'No pages or batches match.',
  searchFailed: 'Batch search failed. Check your connection and try again.',
  minChars: 'Type 2 or more characters to search batches.',
  createBatch: 'Create batch',
  hint: 'Enter to open, arrow keys to move, Esc to close'
} as const;

/** Date range filter chip (redesign R5; used by Batches and Inspections). */
export const DATE_RANGE_STRINGS = {
  apply: 'Apply',
  clear: 'Clear dates',
  range: (from: string, to: string) => (from && to ? `${from} to ${to}` : from ? `from ${from}` : `until ${to}`)
} as const;
