/**
 * Public home page copy (redesign R4.1). Visitors see what TraceX does before they sign in.
 * Plain statements about real features only: no numbers, no customer claims.
 */
export const HOME_STRINGS = {
  navLabel: 'Home page sections',
  nav: {
    how: 'How it works',
    inside: "What's inside",
    roles: 'Who uses it'
  },
  signIn: 'Sign in',
  requestAccess: 'Request access',
  hero: {
    heading: 'Batch traceability for TraceX Technologies',
    lead: 'Record every production batch, ship the batch that expires first, and let shoppers scan the pack to see where it came from.',
    place: 'Wild berries, Himalayan salts and fruit preserves from Uttarakhand, India.'
  },
  how: {
    heading: 'How it works',
    lead: 'Four steps take a batch from the farm lot to the buyer.',
    steps: [
      {
        id: 'record',
        title: 'Record the batch',
        text: 'Log the product, farm lot, farmer, village, pack date, quantity and yield. TraceX gives the batch its code and works out the expiry date.'
      },
      {
        id: 'inspect',
        title: 'Inspect it',
        text: 'A quality inspector fills in the checklist. A failed inspection puts the batch on hold so it cannot be sent out.'
      },
      {
        id: 'dispatch',
        title: 'Dispatch in expiry order',
        text: 'The dispatch queue lists batches with the earliest expiry first. Shipping out of order needs a written reason, and every dispatch is logged.'
      },
      {
        id: 'scan',
        title: 'Shoppers scan the pack',
        text: 'Each batch has its own QR code. Scanning it opens a public page with the product, village, dates and freshness.'
      }
    ]
  },
  inside: {
    heading: "What's inside",
    lead: 'The parts of TraceX your team uses every day.',
    items: [
      { id: 'dashboard', title: 'Dashboard', text: 'What needs action today: expired stock, batches expiring this week, holds and access requests.' },
      { id: 'batches', title: 'Batches', text: 'Every batch with its shelf life, latest inspection and full history.' },
      { id: 'fefo', title: 'Dispatch queue', text: 'First expired, first out. The next batch to ship for each product is at the top.' },
      { id: 'inspections', title: 'Quality inspections', text: 'Checklists, verdicts and comments, kept with the batch.' },
      { id: 'import', title: 'Bulk import', text: 'Bring in many batches from a CSV file, check the errors first, and undo an import if needed.' },
      { id: 'qr', title: 'Public trace page', text: 'What a shopper sees after scanning. Farmer names and contact details are never shown.' }
    ],
    statusHeading: 'Freshness labels used across TraceX',
    statusNote: 'Every batch carries one of these labels, worked out by the server from its expiry date and latest inspection.'
  },
  roles: {
    heading: 'Who uses it',
    lead: 'Each person sees only what their role needs. An administrator approves every new account.',
    items: [
      { id: 'admin', text: 'Manages accounts, roles and access requests.' },
      { id: 'manager', text: 'Watches stock, freshness and dispatch across the company.' },
      { id: 'factory-manager', text: 'Records batches and keeps their details correct.' },
      { id: 'quality-inspector', text: 'Inspects batches and records the verdict.' },
      { id: 'dispatch-coordinator', text: 'Ships batches from the dispatch queue.' }
    ]
  },
  cta: {
    heading: 'Work at TraceX Technologies?',
    text: 'Sign in with your TraceX account, or ask for one and an administrator will review it.'
  },
  footer: {
    about: 'Batch traceability and inventory for TraceX Technologies, Uttarakhand, India.',
    linksLabel: 'Footer',
    copyright: (year: number) => `Copyright ${year} TraceX Technologies`
  }
} as const;
