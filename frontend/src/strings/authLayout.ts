/**
 * Sign-in shell copy (redesign R4, DESIGN.md AuthSplitLayout). The preview says plainly what TraceX
 * does; it shows real status names and no numbers, so nothing reads as made-up data.
 */
export const AUTH_LAYOUT_STRINGS = {
  previewLabel: 'About TraceX',
  heading: 'Batch records from farm to dispatch',
  lead: 'TraceX keeps every production batch of TraceX Technologies in one place: where it came from, how fresh it is, whether it passed inspection, and when it shipped.',
  features: [
    { id: 'trace', text: 'Follow each batch from the farm lot to the buyer' },
    { id: 'fefo', text: 'Ship the batch that expires first' },
    { id: 'qr', text: 'Shoppers scan the pack to see where it came from' }
  ],
  statusPreviewLabel: 'Freshness labels used across TraceX',
  signIn: 'Sign in',
  requestAccess: 'Request access',
  newHere: 'New to TraceX? Ask for an account and an administrator will review it.',
  photoCredit: (author: string) => `Photo: ${author}`
} as const;
