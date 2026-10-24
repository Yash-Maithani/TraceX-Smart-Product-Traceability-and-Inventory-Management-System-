/** Bulk CSV import copy (redesign R5, DESIGN.md §5 and §6.8). */
const rowsWord = (n: number) => (n === 1 ? '1 row' : `${n.toLocaleString()} rows`);
const batchesWord = (n: number) => (n === 1 ? '1 batch' : `${n.toLocaleString()} batches`);

export const IMPORT_STRINGS = {
  title: 'Import batches from CSV',
  subtitle: 'Upload a CSV, match its columns, check the rows, then import.',
  template: 'Download template',
  stepsLabel: 'Import steps',
  steps: {
    upload: 'Upload',
    map: 'Match columns',
    preview: 'Check rows',
    commit: 'Import',
    result: 'Done'
  },
  stepState: { done: 'done', current: 'current step', upcoming: 'not started' },
  upload: {
    title: 'Choose a CSV file',
    body: (maxRows: number) =>
      `Comma, semicolon or tab separated, up to ${maxRows.toLocaleString()} rows. Excel files (.xls, .xlsx) are not accepted: save as CSV first.`,
    drop: 'Choose a .csv file or drop it here',
    reading: 'Reading the file',
    fileLabel: 'Upload CSV file',
    columnsTitle: 'Columns TraceX reads',
    required: 'required',
    columnIdsSummary: 'Exact column names for the CSV header',
    columnIdsNote: 'Use these names in the first row of the file and TraceX matches them automatically.'
  },
  map: {
    title: 'Match your columns',
    fileLine: (file: string, rows: number, cols: number) => `${file}: ${rowsWord(rows)}, ${cols === 1 ? '1 column' : `${cols} columns`}`,
    chooseOther: 'Choose a different file',
    missing: 'Match every required column before checking the rows. Missing:',
    requiredTag: 'Required',
    optionalTag: 'Optional',
    columnFor: (label: string) => `CSV column for ${label}`,
    ignore: 'Not in this file',
    sample: (values: string) => `Sample: ${values}`,
    sampleEmpty: 'Sample: empty in the first 2 rows',
    example: (value: string) => `Example: ${value}`,
    cancel: 'Cancel',
    check: (n: number) => `Check ${rowsWord(n)}`
  },
  preview: {
    title: 'Check the rows',
    body: 'Rows with errors are listed first. Farmer names are not shown here and are never written to logs.',
    errorReport: (n: number) => `Download error list (${n})`,
    backToMap: 'Change column matches',
    totals: { total: 'Rows', insert: 'Will import', skip: 'Duplicates skipped', error: 'Rows with errors' },
    filterLabel: 'Show rows',
    filters: { all: 'All', error: 'Errors', insert: 'Will import', skip: 'Duplicates' },
    caption: 'Rows in the file',
    columns: { row: 'Row', result: 'Result', lot: 'Lot code', product: 'Product', packDate: 'Pack date', village: 'Village', qty: 'Quantity', details: 'Details' },
    verdicts: { insert: 'Will import', skip: 'Duplicate', error: 'Error' },
    duplicate: 'Already in TraceX',
    ready: 'Ready to import',
    startOver: 'Start over',
    importN: (n: number) => `Import ${batchesWord(n)}`
  },
  commit: {
    titleRunning: 'Importing batches',
    titleStopped: 'Import stopped',
    progress: (done: number, total: number, pct: number) => `Part ${done} of ${total} saved (${pct}%)`,
    progressLabel: 'Import progress',
    saving: 'Saving the next part',
    failed: (part: number, total: number) => `Part ${part} of ${total} failed.`,
    jobLabel: 'Import reference',
    partialBody:
      'Nothing was retried. The import is marked failed after 15 minutes. You can then undo it from Recent imports below to remove the batches that were saved.',
    noneSaved: 'No batches were saved.',
    startOver: 'Start over'
  },
  result: {
    title: 'Import finished',
    fileLine: (file: string) => `${file}. Reference:`,
    errorReport: (n: number) => `Download error list (${n})`,
    another: 'Import another file',
    totals: { inserted: 'Batches added', skipped: 'Duplicates skipped', errored: 'Rows with errors', total: 'Rows read' },
    errorsCaption: 'Rows that were not imported'
  },
  history: {
    title: 'Recent imports',
    body: 'An import can be undone while none of its batches have been dispatched.',
    loading: 'Loading recent imports',
    emptyTitle: 'No imports yet',
    emptyBody: 'Imports you run will show up here.',
    caption: 'Recent imports',
    columns: { file: 'File', status: 'Status', inserted: 'Added', skipped: 'Skipped', errored: 'Errors', total: 'Rows', by: 'By', actions: 'Actions' },
    status: { done: 'Done', running: 'Running', rolled_back: 'Undone', failed: 'Failed' } as Record<string, string>,
    details: 'Details',
    undo: 'Undo import',
    detailsLabel: (file: string) => `Details of ${file}`,
    undoLabel: (file: string) => `Undo import of ${file}`
  },
  detail: {
    title: 'Import details',
    loading: 'Loading import details',
    errorReport: 'Download error list',
    close: 'Close',
    noErrors: 'No row errors were recorded for this import.',
    totals: { status: 'Status', inserted: 'Added', skipped: 'Skipped', errored: 'Errors' }
  },
  rollback: {
    title: (file: string, when: string) => `Undo import of ${file}${when ? `, ${when}` : ''}?`,
    body: (n: number) =>
      `This archives the ${batchesWord(n)} this import added, so their lot codes can be imported again. If any of them has been dispatched, the undo is blocked.`,
    confirm: 'Undo import',
    cancel: 'Keep import',
    doneTitle: 'Import undone',
    doneBody: (n: number) => `${batchesWord(n)} archived.`,
    blockedTitle: 'Could not undo the import',
    blockedBody: 'Check that none of its batches has been dispatched, then try again.'
  },
  errorTable: { column: 'Column', problem: 'Problem' },
  leaveWarning: 'Your column matches and checked rows will be lost if you leave this page.',
  errors: {
    readFile: 'Could not read the selected file.',
    headers: 'Could not read the column names in this file.',
    validate: 'Could not check the rows. Try again.',
    commit: 'The import stopped unexpectedly.'
  },
  /** Plain hints per column; the server hint is used for any column not listed here. */
  hints: {
    productSku: 'The product code, for example WBJC. Leave blank to match by product name instead.',
    productName: 'Only used when the product code is blank. Must match a product in TraceX.',
    sourceLotCode: 'The farm or supplier lot this batch came from.',
    farmerName: 'Saved on the batch. Never shown on the public QR page.',
    village: 'Where the raw material was collected.',
    quantityProduced: 'A number of 1 or more.',
    unit: 'Kg, Units or Liters. Common spellings such as kgs, pcs or ltr also work.',
    yieldPercent: 'A number from 0 to 100.',
    packDate: 'A date such as 2026-10-01 or 01/10/2026.'
  } as Record<string, string>
} as const;
