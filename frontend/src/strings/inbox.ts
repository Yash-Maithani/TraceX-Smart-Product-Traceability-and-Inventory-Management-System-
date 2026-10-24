/** Notifications and Messages copy (DESIGN.md §5, §6.10). */
export const NOTIFICATION_STRINGS = {
  title: 'Notifications',
  subtitle: 'Batches, inspections, dispatches, imports and access requests from the last 7 days.',
  unreadCount: (n: number) => (n === 1 ? '1 unread' : `${n} unread`),
  markAll: 'Mark all as read',
  markOne: 'Mark as read',
  read: 'Read',
  unreadPrefix: 'Unread: ',
  open: 'Open',
  today: 'Today',
  yesterday: 'Yesterday',
  emptyTitle: 'You are all caught up',
  emptyBody: 'New updates about batches, inspections and imports will appear here.',
  errorTitle: 'Could not load notifications',
  errorBody: 'Check your connection and try again.',
  loading: 'Loading notifications',
  markedToast: (n: number) => (n === 1 ? '1 marked as read' : `${n} marked as read`),
  nothingToMark: 'Nothing left to mark',
  markFailed: 'Could not mark notifications as read'
} as const;

export const MESSAGE_STRINGS = {
  title: 'Messages',
  subtitle: (days: number) =>
    `A channel for each role. Messages are kept for ${days} days. For decisions about a batch or inspection, comment on that record instead.`,
  channelsLabel: 'Channels',
  channelTitle: (label: string) => `${label} channel`,
  members: (n: number) => `${n} active members can read this channel.`,
  composerLabel: (label: string) => `Message the ${label} channel`,
  emptyTitle: 'No messages in this channel yet',
  emptyBody: 'Use this channel for shift handover and coordination.',
  noChannelsTitle: 'No channels',
  noChannelsBody: 'Your account has no role channel. Ask an administrator to check your role.',
  errorChannels: 'Could not load channels',
  errorChannel: 'Could not load this channel',
  errorBody: 'Check your connection and try again.',
  loadingChannels: 'Loading channels',
  loadingMessages: 'Loading messages'
} as const;
