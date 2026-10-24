/** Team and access copy (redesign R6, DESIGN.md §5 and §6.9). */
export const TEAM_STRINGS = {
  title: 'Team and access',
  subtitleAdmin: 'Who can use TraceX, their roles, and new access requests.',
  subtitleReadOnly: 'Who can use TraceX and which access requests are waiting. Changes need an administrator.',
  tabsLabel: 'Team lists',
  tabs: { users: 'People', requests: 'Access requests', recycle: 'Deleted' },
  searchLabel: 'Search people and requests',
  searchPlaceholder: 'Search name, username or email',
  loading: 'Loading the list',
  errorTitle: 'Could not load this list',
  errorBody: 'Check your connection and try again.',
  noMatchTitle: 'Nothing matches this search',
  noMatchBody: 'Try a different name or email.',
  usersEmpty: 'No team members yet',
  requestsEmpty: 'No access requests',
  requestsEmptyBody: 'Requests from the sign-in page show up here for an administrator to approve.',
  recycleEmpty: 'Nothing has been deleted',
  recycleEmptyBody: 'Deleted accounts stay here so a super administrator can restore them.',
  you: 'You',
  noActions: 'No changes allowed',
  viewOnly: 'View only',
  superAdmin: 'Super administrator',
  listLabel: { users: 'People', requests: 'Access requests', recycle: 'Deleted accounts' },
  columns: { person: 'Person', email: 'Email', role: 'Role', status: 'Status', requested: 'Requested', deleted: 'Deleted' },
  actionsFor: (name: string) => `Actions for ${name}`,
  actions: {
    changeRole: 'Change role',
    activate: 'Activate',
    deactivate: 'Deactivate',
    delete: 'Delete account',
    approve: 'Approve',
    resend: 'Resend invite',
    reject: 'Reject',
    remove: 'Remove request',
    restore: 'Restore'
  },
  requestStatus: {
    accountCreated: 'Account created',
    inviteExpires: (when: string) => `Invite expires ${when}`
  },
  done: {
    activated: (u: string) => `${u} activated`,
    deactivated: (u: string) => `${u} deactivated`,
    invited: (email: string) => `Invite sent to ${email}`,
    resent: (email: string) => `New invite sent to ${email}`,
    removed: (email: string) => `Request from ${email} removed`,
    restored: (u: string) => `${u} restored`,
    roleChanged: (u: string, role: string) => `${u} is now ${role}`,
    deleted: (u: string) => `${u} deleted. A super administrator can restore the account.`,
    rejected: (email: string) => `Request from ${email} rejected`
  },
  failedTitle: 'That change did not go through',
  failedBody: 'The server refused it. Refresh the page and try again.',
  roleDialog: {
    title: (u: string) => `Change the role of ${u}`,
    body: 'The new role applies from their next action. They stay signed in.',
    field: 'New role',
    cancel: 'Cancel',
    save: 'Save role'
  },
  deleteDialog: {
    title: (u: string) => `Delete the account of ${u}?`,
    body: 'They are signed out at once and can no longer sign in. A super administrator can restore the account from Deleted.',
    reason: 'Reason (optional)',
    cancel: 'Keep account',
    confirm: 'Delete account'
  },
  rejectDialog: {
    title: (email: string) => `Reject the request from ${email}?`,
    body: 'Any invite already sent for this request stops working.',
    note: 'Note (optional)',
    cancel: 'Keep request',
    confirm: 'Reject request'
  }
} as const;
