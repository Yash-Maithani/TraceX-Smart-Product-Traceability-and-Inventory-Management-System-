import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MailPlus, MoreHorizontal, RotateCcw, Search, Trash2, UserCog, UserMinus, UserPlus, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import batchStyles from '../batches/batches.module.css';
import consoleStyles from '../../components/ui/console.module.css';
import styles from './team.module.css';
import {
  approveAccessRequest,
  changeUserRole,
  deleteAccessRequest,
  deleteTeamUser,
  fetchAccessRequests,
  fetchDeletedUsers,
  fetchTeamUsers,
  rejectAccessRequest,
  resendAccessInvite,
  restoreTeamUser,
  toggleUserActive
} from '../../api/endpoints';
import type { AccessRequestSummaryDto, UserRole, UserSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canCallEndpoint } from '../../auth/permissions.generated';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Popover,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  useToast
} from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';
import { STRINGS } from '../../strings/en';
import { TEAM_STRINGS as S } from '../../strings/team';

type TeamTab = 'users' | 'requests' | 'recycle';

const ROLE_OPTIONS: UserRole[] = ['admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'];

function roleLabel(role?: string): string {
  if (!role) return EMPTY_VALUE;
  return (STRINGS.roles as Record<string, string>)[role] ?? role;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Case-insensitive match on any of the given fields. */
function matches(term: string, ...fields: Array<string | undefined>): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  return fields.some((f) => (f ?? '').toLowerCase().includes(t));
}

/**
 * Team and access (Phase 9, redesigned in R6). The server is the authority on every rule; the UI only
 * hides actions the server would refuse, using the same rules as SPEC §2 Admin-vs-Admin.
 */
export function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  // The dashboard's access-request tile opens /team?tab=requests
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const canSeeRecycleBin = canCallEndpoint(user, 'GET', '/api/v1/auth/users/deleted');
  const tab: TeamTab = tabParam === 'requests' ? 'requests' : tabParam === 'recycle' && canSeeRecycleBin ? 'recycle' : 'users';
  const [search, setSearch] = useState('');

  const canWriteUsers = canCallEndpoint(user, 'PATCH', '/api/v1/auth/users/:id/toggle');
  const canWriteRequests = canCallEndpoint(user, 'POST', '/api/v1/auth/requests/:id/approve');
  const isSuperAdmin = user?.superAdmin === true;

  const [roleTarget, setRoleTarget] = useState<UserSummaryDto | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('manager');
  const [deleteTarget, setDeleteTarget] = useState<UserSummaryDto | null>(null);
  const [deleteNote, setDeleteNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<AccessRequestSummaryDto | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const usersQuery = useQuery({ queryKey: ['team', 'users'], queryFn: fetchTeamUsers });
  const requestsQuery = useQuery({ queryKey: ['team', 'requests'], queryFn: fetchAccessRequests });
  const deletedQuery = useQuery({
    queryKey: ['team', 'deleted'],
    queryFn: fetchDeletedUsers,
    enabled: canSeeRecycleBin
  });

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    ]);
  };

  // One mutation runner keeps the busy state, toast and refresh identical for every action
  const action = useMutation({
    mutationFn: async (job: { key: string; run: () => Promise<unknown>; done: string }) => {
      setBusyKey(job.key);
      await job.run();
      return job.done;
    },
    onSuccess: async (done) => {
      setBusyKey(null);
      await refreshTeam();
      pushToast({ title: done, variant: 'success' });
    },
    onError: (err) => {
      setBusyKey(null);
      pushToast({ title: S.failedTitle, description: errorText(err, S.failedBody), variant: 'error' });
    }
  });

  const isBusy = (key: string) => action.isPending && busyKey === key;

  /** Mirrors UserService: never yourself, never a super-admin, and only a super-admin may act on an admin. */
  const canManage = (target: UserSummaryDto) => {
    if (!canWriteUsers || !target.id || target.id === user?.id) return false;
    if (target.superAdmin) return false;
    if (target.role === 'admin' && !isSuperAdmin) return false;
    return true;
  };

  const users = usersQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const deleted = deletedQuery.data ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const term = search.trim();
  const shownUsers = users.filter((u) => matches(term, u.name, u.username, u.email));
  const shownRequests = requests.filter((r) => matches(term, r.name, r.email));
  const shownDeleted = deleted.filter((u) => matches(term, u.name, u.username, u.email));

  const selectTab = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'users') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const userMenu = (row: UserSummaryDto) => (
    <Popover
      label={S.actionsFor(row.name ?? row.username ?? '')}
      align="end"
      renderTrigger={({ ref, ...p }) => (
        <button
          ref={ref}
          type="button"
          {...p}
          className={styles.menuTrigger}
          aria-label={S.actionsFor(row.name ?? row.username ?? '')}
          data-testid={`team-actions-btn-${row.username}`}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <ul className={consoleStyles.menuList}>
          <li>
            <button
              type="button"
              className={consoleStyles.menuItem}
              onClick={() => {
                close();
                setRoleTarget(row);
                setNewRole((row.role as UserRole) ?? 'manager');
              }}
              data-testid={`team-role-btn-${row.username}`}
            >
              <UserCog size={16} aria-hidden="true" /> {S.actions.changeRole}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={consoleStyles.menuItem}
              disabled={action.isPending}
              onClick={() => {
                close();
                action.mutate({
                  key: `toggle-${row.id}`,
                  run: () => toggleUserActive(row.id!),
                  done: row.active === false ? S.done.activated(row.username ?? '') : S.done.deactivated(row.username ?? '')
                });
              }}
              data-testid={`team-toggle-btn-${row.username}`}
            >
              {row.active === false ? <UserPlus size={16} aria-hidden="true" /> : <UserMinus size={16} aria-hidden="true" />}{' '}
              {row.active === false ? S.actions.activate : S.actions.deactivate}
            </button>
          </li>
          <li>
            <hr className={consoleStyles.menuSeparator} />
          </li>
          <li>
            <button
              type="button"
              className={`${consoleStyles.menuItem} ${consoleStyles.menuItemDanger}`}
              onClick={() => {
                close();
                setDeleteTarget(row);
                setDeleteNote('');
              }}
              data-testid={`team-delete-btn-${row.username}`}
            >
              <Trash2 size={16} aria-hidden="true" /> {S.actions.delete}
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );

  const requestMenu = (row: AccessRequestSummaryDto) => (
    <Popover
      label={S.actionsFor(row.email ?? '')}
      align="end"
      renderTrigger={({ ref, ...p }) => (
        <button
          ref={ref}
          type="button"
          {...p}
          className={styles.menuTrigger}
          aria-label={S.actionsFor(row.email ?? '')}
          data-testid={`request-actions-btn-${row.email}`}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <ul className={consoleStyles.menuList}>
          {row.status !== 'rejected' && !row.inviteUsed ? (
            <li>
              <button
                type="button"
                className={`${consoleStyles.menuItem} ${consoleStyles.menuItemDanger}`}
                onClick={() => {
                  close();
                  setRejectTarget(row);
                  setRejectNote('');
                }}
                data-testid={`request-reject-btn-${row.email}`}
              >
                <X size={16} aria-hidden="true" /> {S.actions.reject}
              </button>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              className={consoleStyles.menuItem}
              disabled={action.isPending}
              onClick={() => {
                close();
                action.mutate({
                  key: `delete-request-${row.id}`,
                  run: () => deleteAccessRequest(row.id!),
                  done: S.done.removed(row.email ?? '')
                });
              }}
              data-testid={`request-delete-btn-${row.email}`}
            >
              <Trash2 size={16} aria-hidden="true" /> {S.actions.remove}
            </button>
          </li>
        </ul>
      )}
    </Popover>
  );

  const renderPanel = (
    query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown },
    total: number,
    shown: number,
    empty: { title: string; body?: string },
    list: ReactNode
  ) => {
    if (query.isLoading) return <Skeleton label={S.loading} />;
    if (query.isError) {
      return <ErrorState title={S.errorTitle} description={errorText(query.error, S.errorBody)} onRetry={() => void query.refetch()} />;
    }
    if (total === 0) return empty.body ? <EmptyState title={empty.title} description={empty.body} /> : <EmptyState title={empty.title} />;
    if (shown === 0) return <EmptyState title={S.noMatchTitle} description={S.noMatchBody} />;
    return list;
  };

  return (
    <div className={batchStyles.page} data-testid="team-page">
      <PageHeader title={S.title} subtitle={canWriteUsers ? S.subtitleAdmin : S.subtitleReadOnly} backdropKey="team" priority />

      <Tabs
        label={S.tabsLabel}
        idPrefix="team"
        selectedId={tab}
        onSelect={selectTab}
        tabs={[
          { id: 'users', label: S.tabs.users, count: users.length, testId: 'team-tab-users' },
          { id: 'requests', label: S.tabs.requests, count: pendingCount, testId: 'team-tab-requests' },
          ...(canSeeRecycleBin ? [{ id: 'recycle', label: S.tabs.recycle, count: deleted.length, testId: 'team-tab-recycle' }] : [])
        ]}
      />

      <section className={batchStyles.toolbar} aria-label={S.searchLabel}>
        <label className={batchStyles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{S.searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={S.searchPlaceholder}
            data-testid="team-search"
          />
        </label>
      </section>

      <div id={`team-panel-${tab}`} role="tabpanel" aria-labelledby={`team-tab-${tab}`} data-testid={`team-panel-${tab}`}>
        {tab === 'users'
          ? renderPanel(
              usersQuery,
              users.length,
              shownUsers.length,
              { title: S.usersEmpty },
              <ul className={styles.list} aria-label={S.listLabel.users}>
                {shownUsers.map((row) => (
                  <li key={row.id ?? row.username} className={styles.row} data-testid={`team-row-${row.username}`}>
                    <span className={styles.person}>
                      <span className={styles.name}>{row.name ?? row.username}</span>
                      <span className={batchStyles.muted}>
                        <span className={batchStyles.mono}>{row.username}</span>
                        {row.email ? `, ${row.email}` : ''}
                      </span>
                    </span>
                    <span className={styles.role}>
                      {roleLabel(row.role)}
                      {row.superAdmin ? <span className={batchStyles.muted}>{S.superAdmin}</span> : null}
                    </span>
                    <span>
                      <StatusBadge status={row.active === false ? 'inactive' : 'active'} />
                    </span>
                    <span className={styles.actions}>
                      {canManage(row) ? (
                        isBusy(`toggle-${row.id}`) ? <span className={batchStyles.muted}>{S.loading}</span> : userMenu(row)
                      ) : (
                        <span className={batchStyles.muted}>{row.id === user?.id ? S.you : canWriteUsers ? S.noActions : S.viewOnly}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )
          : null}

        {tab === 'requests'
          ? renderPanel(
              requestsQuery,
              requests.length,
              shownRequests.length,
              { title: S.requestsEmpty, body: S.requestsEmptyBody },
              <ul className={styles.list} aria-label={S.listLabel.requests}>
                {shownRequests.map((row) => (
                  <li key={row.id ?? row.email} className={styles.row} data-testid={`request-row-${row.email}`}>
                    <span className={styles.person}>
                      <span className={styles.name}>{row.name}</span>
                      <span className={batchStyles.muted}>
                        {row.email}, {formatTimestamp(row.createdAt)}
                      </span>
                    </span>
                    <span className={styles.role}>{roleLabel(row.role)}</span>
                    <span className={styles.person}>
                      <StatusBadge status={row.status ?? 'pending'} />
                      {row.status === 'approved' ? (
                        <span className={batchStyles.muted}>
                          {row.inviteUsed ? S.requestStatus.accountCreated : S.requestStatus.inviteExpires(formatTimestamp(row.inviteExpiry))}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.actions}>
                      {canWriteRequests && row.id ? (
                        <>
                          {row.status !== 'approved' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Check size={14} />}
                              isLoading={isBusy(`approve-${row.id}`)}
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({
                                  key: `approve-${row.id}`,
                                  run: () => approveAccessRequest(row.id!),
                                  done: S.done.invited(row.email ?? '')
                                })
                              }
                              data-testid={`request-approve-btn-${row.email}`}
                            >
                              {S.actions.approve}
                            </Button>
                          ) : null}
                          {row.status === 'approved' && !row.inviteUsed ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<MailPlus size={14} />}
                              isLoading={isBusy(`resend-${row.id}`)}
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate({
                                  key: `resend-${row.id}`,
                                  run: () => resendAccessInvite(row.id!),
                                  done: S.done.resent(row.email ?? '')
                                })
                              }
                              data-testid={`request-resend-btn-${row.email}`}
                            >
                              {S.actions.resend}
                            </Button>
                          ) : null}
                          {requestMenu(row)}
                        </>
                      ) : (
                        <span className={batchStyles.muted}>{S.viewOnly}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )
          : null}

        {tab === 'recycle' && canSeeRecycleBin
          ? renderPanel(
              deletedQuery,
              deleted.length,
              shownDeleted.length,
              { title: S.recycleEmpty, body: S.recycleEmptyBody },
              <ul className={styles.list} aria-label={S.listLabel.recycle}>
                {shownDeleted.map((row) => (
                  <li key={row.id ?? row.username} className={styles.row} data-testid={`recycle-row-${row.username}`}>
                    <span className={styles.person}>
                      <span className={styles.name}>{row.name ?? row.username}</span>
                      <span className={batchStyles.muted}>{row.email ?? EMPTY_VALUE}</span>
                    </span>
                    <span className={styles.role}>{roleLabel(row.role)}</span>
                    <span className={batchStyles.muted}>
                      {S.columns.deleted} {formatTimestamp(row.updatedAt)}
                    </span>
                    <span className={styles.actions}>
                      {row.id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<RotateCcw size={14} />}
                          isLoading={isBusy(`restore-${row.id}`)}
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              key: `restore-${row.id}`,
                              run: () => restoreTeamUser(row.id!),
                              done: S.done.restored(row.username ?? '')
                            })
                          }
                          data-testid={`recycle-restore-btn-${row.username}`}
                        >
                          {S.actions.restore}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )
          : null}
      </div>

      <Dialog
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title={S.roleDialog.title(roleTarget?.name ?? roleTarget?.username ?? '')}
        description={S.roleDialog.body}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRoleTarget(null)}>
              {S.roleDialog.cancel}
            </Button>
            <Button
              variant="primary"
              isLoading={roleTarget !== null && isBusy(`role-${roleTarget.id}`)}
              disabled={action.isPending || newRole === roleTarget?.role}
              onClick={() => {
                const target = roleTarget;
                if (!target?.id) return;
                action.mutate(
                  {
                    key: `role-${target.id}`,
                    run: () => changeUserRole(target.id!, { role: newRole }),
                    done: S.done.roleChanged(target.username ?? '', roleLabel(newRole))
                  },
                  { onSuccess: () => setRoleTarget(null) }
                );
              }}
              data-testid="team-role-save-btn"
            >
              {S.roleDialog.save}
            </Button>
          </>
        }
      >
        <Field label={S.roleDialog.field} required>
          <Select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            options={ROLE_OPTIONS.filter((r) => r !== 'admin' || isSuperAdmin).map((r) => ({
              value: r,
              label: roleLabel(r)
            }))}
            data-testid="team-role-select"
          />
        </Field>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={S.deleteDialog.title(deleteTarget?.name ?? deleteTarget?.username ?? '')}
        description={S.deleteDialog.body}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {S.deleteDialog.cancel}
            </Button>
            <Button
              variant="danger"
              isLoading={deleteTarget !== null && isBusy(`delete-${deleteTarget.id}`)}
              disabled={action.isPending}
              onClick={() => {
                const target = deleteTarget;
                if (!target?.id) return;
                action.mutate(
                  {
                    key: `delete-${target.id}`,
                    run: () => deleteTeamUser(target.id!, deleteNote.trim() ? { deleteNote: deleteNote.trim() } : {}),
                    done: S.done.deleted(target.username ?? '')
                  },
                  { onSuccess: () => setDeleteTarget(null) }
                );
              }}
              data-testid="team-delete-confirm-btn"
            >
              {S.deleteDialog.confirm}
            </Button>
          </>
        }
      >
        <Field label={S.deleteDialog.reason}>
          <Textarea value={deleteNote} onChange={(e) => setDeleteNote(e.target.value)} maxLength={500} rows={3} data-testid="team-delete-note" />
        </Field>
      </Dialog>

      <Dialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={S.rejectDialog.title(rejectTarget?.email ?? '')}
        description={S.rejectDialog.body}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              {S.rejectDialog.cancel}
            </Button>
            <Button
              variant="danger"
              isLoading={rejectTarget !== null && isBusy(`reject-${rejectTarget.id}`)}
              disabled={action.isPending}
              onClick={() => {
                const target = rejectTarget;
                if (!target?.id) return;
                action.mutate(
                  {
                    key: `reject-${target.id}`,
                    run: () => rejectAccessRequest(target.id!, rejectNote.trim() ? { note: rejectNote.trim() } : {}),
                    done: S.done.rejected(target.email ?? '')
                  },
                  { onSuccess: () => setRejectTarget(null) }
                );
              }}
              data-testid="request-reject-confirm-btn"
            >
              {S.rejectDialog.confirm}
            </Button>
          </>
        }
      >
        <Field label={S.rejectDialog.note}>
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} maxLength={500} rows={3} data-testid="request-reject-note" />
        </Field>
      </Dialog>
    </div>
  );
}
