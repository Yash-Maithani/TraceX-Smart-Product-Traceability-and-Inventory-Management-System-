/** Batch detail copy (DESIGN.md §5, §6.4). */
export const DETAIL_STRINGS = {
  titleLoading: 'Batch',
  breadcrumbBatches: 'Batches',
  loading: 'Loading batch details',
  errorTitle: 'Could not load this batch',
  print: 'Print',
  correct: 'Correct details',
  archive: 'Archive',
  dispatch: 'Dispatch',
  advisory: 'Dispatch note:',
  exception: 'Expiry date problem:',
  exceptionFallback: 'The expiry date is missing or not a valid date. Correct the details to fix it.',
  quantity: (qty: number | undefined, unit: string | undefined) => `${qty ?? 0} ${unit ?? ''}`.trim(),
  bestBefore: (date: string) => `Best before ${date}`,
  history: {
    heading: 'History',
    subtitle: 'Everything recorded on this batch, newest first.',
    empty: 'Nothing has happened to this batch since it was packed.',
    packedLabel: 'Packed',
    packed: (qty: string) => `Packed ${qty}`,
    packedBody: (lot: string, village: string) => `Lot ${lot} from ${village}`,
    noteLabel: 'Note changed',
    note: (who: string) => `Note updated by ${who}`,
    inspectionLabel: (verdict: string) => `Inspection ${verdict.toLowerCase()}`,
    inspection: (verdict: string, rating: number) => {
      const word = verdict === 'PASSED' ? 'passed' : verdict === 'FAILED' ? 'failed' : 'flagged';
      return `Inspection ${word}, rated ${rating} of 5`;
    },
    dispatchLabel: 'Dispatched',
    dispatch: (buyer: string) => `Dispatched to ${buyer}`,
    dispatchedBy: (who: string) => `Recorded by ${who}`,
    override: (reason: string) => `Shipped out of order. Reason: ${reason}`,
    scanLabel: 'Scanned',
    scans: (n: number) => (n === 1 ? 'QR code scanned once' : `QR code scanned ${n} times, last scan`)
  },
  details: {
    heading: 'Details',
    subtitle: 'Product, dates and where the raw material came from.'
  },
  quality: {
    heading: 'Latest inspection',
    subtitle: 'The verdict that decides whether this batch can ship.',
    emptyTitle: 'Not inspected yet',
    emptyBody: 'A quality inspector records inspections from the Inspections page.'
  },
  note: {
    heading: 'Traceability note',
    saved: 'Note saved',
    savedBody: 'The new note is on the batch and in its history.'
  },
  qr: {
    heading: 'QR code',
    subtitle: 'Print it on the pack. Shoppers who scan it see the public trace page.',
    copy: 'Copy link',
    download: 'Download PNG',
    printLabel: 'Print label',
    open: 'Open public page',
    copied: 'Link copied',
    copiedBody: 'The public trace link is on your clipboard.'
  },
  scans: {
    heading: 'Scans',
    subtitle: 'How often the QR code was scanned, and from what.',
    emptyTitle: 'No scans yet',
    emptyBody: 'Nobody has scanned this QR code yet.'
  },
  dispatches: {
    heading: 'Dispatches',
    subtitle: 'Who it was shipped to, and why if it went out of order.',
    emptyTitle: 'Not dispatched yet',
    emptyBody: 'Dispatches will show up here.'
  },
  inspections: {
    heading: 'Inspections',
    subtitle: 'Every inspection of this batch. They cannot be changed or deleted.',
    restricted: 'Your role cannot open inspection checklists. The latest verdict is shown under Latest inspection.',
    emptyTitle: 'No inspections yet',
    emptyBody: 'A quality inspector records inspections from the Inspections page.'
  },
  comments: {
    heading: 'Comments',
    subtitle: 'Why a decision was taken on this batch. Comments stay with the batch.'
  },
  archiveDialog: {
    title: (code: string) => `Archive ${code}?`,
    body: 'It leaves the batch list and the dispatch queue, and its QR link stops working. An administrator can restore it from Archived.',
    confirm: 'Archive batch',
    cancel: 'Keep batch',
    reason: 'Reason for archiving',
    done: 'Batch archived',
    doneBody: (code: string) => `${code} moved to Archived.`,
    failed: 'Could not archive the batch'
  },
  correction: {
    title: (code: string) => `Correct details of ${code}`,
    body: 'Fix origin, quantity or dates. The change and its reason go into the audit log.',
    cancel: 'Cancel',
    save: 'Save correction',
    saved: 'Details corrected',
    savedBody: 'The batch, the dispatch queue and the dashboard now use the corrected values.'
  },
  discard: {
    title: 'Discard your changes?',
    body: 'The corrections you typed are not saved yet.',
    confirm: 'Discard changes',
    cancel: 'Keep editing'
  }
} as const;
