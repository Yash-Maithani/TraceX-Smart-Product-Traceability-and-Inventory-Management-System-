/** AI features copy (AI phase): dispatch brief, Ask TraceX and the inspection assistant. */
export const AI_STRINGS = {
  providers: { gemini: 'Google Gemini', nvidia: 'NVIDIA' } as Record<string, string>,
  brief: {
    title: 'Dispatch brief',
    subtitle: 'Worked out from the dispatch rules and the latest inspections. Updates whenever batches change.',
    loading: 'Loading the dispatch brief',
    error: 'Could not load the dispatch brief.',
    shipNext: 'Ship next',
    shipNextNote: 'The first batch of each product that is not on hold.',
    nothingToShip: 'Nothing is ready to ship.',
    attention: 'Needs attention',
    allClear: 'Nothing needs attention right now.',
    groups: {
      urgent: 'Expiring within 7 days',
      onHold: 'On hold',
      expired: 'Expired',
      quality: 'Quality warnings'
    },
    more: (n: number) => `and ${n} more`,
    daysLeft: (n: number | undefined) => (n === undefined ? '' : n === 1 ? '1 day left' : `${n} days left`),
    aiTitle: 'AI summary',
    aiIntro: 'A short summary and patterns the rules cannot see, such as too much stock from one village.',
    aiRun: 'Write AI summary',
    aiRunAgain: 'Write it again',
    aiDisclaimer: 'Advice only, and it can be wrong. The dispatch order comes from the rules above.',
    aiMeta: (provider: string, when: string, saved: boolean) => `By ${provider}, ${when}${saved ? ' (saved, data unchanged)' : ''}.`,
    aiRisks: 'Patterns to watch',
    aiNotes: {
      unavailable: 'The AI service did not answer. The facts above are still correct; try again later.',
      limit: 'You have asked for several summaries recently. Try again in a few minutes.'
    } as Record<string, string>,
    severity: { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' } as Record<string, string>
  },
  ask: {
    group: 'Ask TraceX',
    option: (q: string) => `Ask TraceX: "${q}"`,
    hint: 'Questions in plain words, for example "jam batches expiring this week, not inspected".',
    thinking: 'Reading your question',
    searched: 'Searched for',
    count: (n: number) => (n === 1 ? '1 batch matches.' : `${n} batches match.`),
    none: 'No batches match.',
    showing: (shown: number, total: number) => `Showing the first ${shown} of ${total}.`,
    openList: 'Open in the batch list',
    back: 'Back to search',
    failed: 'Could not answer that. Try asking it another way.',
    disclaimer: 'The AI only turns your question into a filter. The batches come straight from TraceX.'
  },
  draft: {
    label: 'Your notes',
    hint: 'Write what you checked in your own words. The AI fills in the form below for you to review. Notes are sent to the AI service, so leave out personal names.',
    placeholder: 'For example: cap seal broken on 3 of 20 jars, labels clear, colour and smell normal, stored at 4 degrees.',
    fill: 'Fill the form from my notes',
    filling: 'Filling the form',
    filled: 'Form filled from your notes. Check every field before saving.',
    adjusted: 'TraceX corrected:',
    failed: 'Could not fill the form. You can still fill it in yourself.'
  }
} as const;
