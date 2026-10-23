/**
 * Privacy Policy and Terms and Conditions text (Phase 12). Plain language, and every statement matches
 * what the code actually stores: see the model classes under backend/src/main/java/com/tracex/model and
 * the retention indexes noted beside each item. Update LEGAL_UPDATED whenever the text changes.
 */

export const LEGAL_UPDATED = '23 October 2026';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      'TraceX is the batch traceability and inventory system used by TraceX Technologies, an organic food company in Uttarakhand, India. This policy explains what TraceX stores, why, for how long, and who can see it. Questions go to your TraceX administrator.'
    ]
  },
  {
    heading: 'What we store',
    items: [
      'Staff accounts: name, username, email address, optional phone number, role, a one-way hash of your password (never the password itself), your display settings, and the Google email address if you link Google sign-in.',
      'Access requests: the name, email address and role entered on the request form.',
      'Batch records: product, lot code, pack and expiry dates, quantity, yield, the supplying farmer\'s name and village, inspection results, dispatch details including the buyer\'s name, and the notes and comments added to the batch.',
      'Sign-in history: the time of each sign-in and the browser, operating system and device type, for 30 days. No IP address and no location is stored.',
      'Public QR scans: the time of the scan, the device type, and a one-way hash of the IP address so repeat scans can be counted. The address itself is not stored.',
      'An audit log of every change made in the system (who did what and when), so decisions can be traced.',
      'Notifications for 7 days, and role chat messages for 90 days. Comments on batches and inspections are kept with the record.'
    ]
  },
  {
    heading: 'What your browser stores',
    items: [
      'Your sign-in token, in session storage. It is removed when you close the tab or sign out.',
      'Your display settings (theme, colours, page photos, sidebar), in local storage.',
      'No advertising or tracking cookies, and no analytics scripts.'
    ]
  },
  {
    heading: 'Emails we send',
    paragraphs: [
      'TraceX sends account invitations and one-time codes for activating an account or resetting a password. It does not send marketing email.'
    ]
  },
  {
    heading: 'Who can see your data',
    items: [
      'Staff see only what their role allows. Administrators manage accounts; managers can view them.',
      'The public QR trace page shows the product, batch code, dates and freshness status. It never shows the farmer\'s name or anyone\'s contact details.',
      'If the AI dispatch audit is switched on, current batch details are sent to Google Gemini (or NVIDIA as a backup) to produce advice. Farmer names are never sent.',
      'If Google sign-in is switched on and you use it, Google confirms your email address to TraceX.',
      'We do not sell or share data with anyone else.'
    ]
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'You can update your name, email and phone number on the Profile page, and unlink Google there at any time. To see the data held about you, or to ask for your account to be removed, contact your TraceX administrator. Removed accounts are deactivated rather than erased, because the audit log must keep showing who did what.'
    ]
  },
  {
    heading: 'Security',
    paragraphs: [
      'Passwords are hashed, sign-in sessions expire after 8 hours and can be revoked at any time, codes expire after 10 minutes, and every change is logged. No system is perfectly secure, so tell your administrator straight away if you think your account has been misused.'
    ]
  }
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Who may use TraceX',
    paragraphs: [
      'TraceX is for authorised staff of TraceX Technologies. Accounts are created only after an administrator approves an access request. The public QR trace page may be used by anyone holding a product\'s QR code.'
    ]
  },
  {
    heading: 'Your account',
    items: [
      'Keep your password private and do not share your account.',
      'Use a password of at least 8 characters that you do not use elsewhere.',
      'Sign out on shared computers, and use "Sign out everywhere" on the Profile page if you think someone else has used your account.'
    ]
  },
  {
    heading: 'Acceptable use',
    items: [
      'Enter accurate information. Batch, inspection and dispatch records are used to make food-safety decisions.',
      'Do not try to reach data or actions your role does not allow, or to bypass the dispatch and quality-hold rules.',
      'Do not post offensive, private or unrelated content in messages or comments.'
    ]
  },
  {
    heading: 'Records and audit',
    paragraphs: [
      'Every change is recorded with who made it and when. Batches are archived, not deleted, and comments on records are kept permanently, because traceability depends on a complete history.'
    ]
  },
  {
    heading: 'AI advice',
    paragraphs: [
      'When the AI dispatch audit is switched on, its suggestions are advice only. They can be wrong. Staff remain responsible for dispatch decisions, which still follow the first-expired, first-out rules in TraceX.'
    ]
  },
  {
    heading: 'Public trace information',
    paragraphs: [
      'The public trace page is for information. It shows the product\'s records as entered by staff, without any warranty.'
    ]
  },
  {
    heading: 'Availability and liability',
    paragraphs: [
      'TraceX is provided as it is. We aim to keep it available and correct but cannot promise it will always be either, and we are not liable for losses caused by downtime or by information entered incorrectly, to the extent the law allows.'
    ]
  },
  {
    heading: 'Ending access',
    paragraphs: [
      'Administrators can deactivate an account at any time, for example when someone leaves or misuses the system. Deactivation signs the account out everywhere straight away.'
    ]
  },
  {
    heading: 'Changes and governing law',
    paragraphs: [
      'These terms may be updated; the date below shows the latest version. They are governed by the laws of India. Questions go to your TraceX administrator.'
    ]
  }
];
