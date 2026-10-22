import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MailPlus, RotateCcw, Trash2, UserCog, UserMinus, UserPlus, X } from 'lucide-react';
import coreStyles from '../core/core.module.css';
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
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Textarea,
  useToast,
  type TableColumn
} from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';
import { STRINGS } from '../../strings/en';

type TeamTab = 'users' | 'requests' | 'recycle';

const ROLE_OPTIONS: UserRole[] = ['admin', 'manager', 'factory-manager', 'quality-inspector', 'dispatch-coordinator'];

function roleLabel(role?: string): string {
  if (!role) return EMPTY_VALUE;
  return (STRINGS.roles as Record<string, string>)[role] ?? role;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Team & Access (Phase 9). The server is the authority on every rule; the UI only hides
 * actions the server would refuse, using the same rules as SPEC §2 Admin-vs-Admin.
 */
export function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [tab, setTab] = useState<TeamTab>('users');

  const canWriteUsers = canCallEndpoint(user, 'PATCH', '/api/v1/auth/users/:id/toggle');
  const canWriteRequests = canCallEndpoint(user, 'POST', '/api/v1/auth/requests/:id/approve');
  const canSeeRecycleBin = canCallEndpoint(user, 'GET', '/api/v1/auth/users/deleted');
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
      pushToast({ title: 'Action failed', description: errorText(err, 'The server refused this change.'), variant: 'error' });
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

  const userColumns: TableColumn<UserSummaryDto>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <strong>{row.name ?? row.username}</strong>
          <div className={coreStyles.metaLabel}>
            <span className={coreStyles.monoCode}>{row.username}</span>
          </div>
        </div>
      )
    },
    { key: 'email', header: 'Email', render: (row) => <span>{row.email ?? EMPTY_VALUE}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span>
          {roleLabel(row.role)}
          {row.superAdmin ? ' (Super Admin)' : ''}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.active === false ? 'inactive' : 'active'} />
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) =>
        canManage(row) ? (
          <div className={coreStyles.inlineRow}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<UserCog size={14} />}
              onClick={() => {
                setRoleTarget(row);
                setNewRole((row.role as UserRole) ?? 'manager');
              }}
              data-testid={`team-role-btn-${row.username}`}
            >
              Role
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={row.active === false ? <UserPlus size={14} /> : <UserMinus size={14} />}
              isLoading={isBusy(`toggle-${row.id}`)}
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  key: `toggle-${row.id}`,
                  run: () => toggleUserActive(row.id!),
                  done: row.active === false ? `${row.username} activated` : `${row.username} deactivated`
                })
              }
              data-testid={`team-toggle-btn-${row.username}`}
            >
              {row.active === false ? 'Activate' : 'Deactivate'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={() => {
                setDeleteTarget(row);
                setDeleteNote('');
              }}
              data-testid={`team-delete-btn-${row.username}`}
            >
              Delete
            </Button>
          </div>
        ) : (
          <span className={coreStyles.metaLabel}>{row.id === user?.id ? 'You' : 'No actions'}</span>
        )
    }
  ];

  const requestColumns: TableColumn<AccessRequestSummaryDto>[] = [
    {
      key: 'name',
      header: 'Applicant',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className={coreStyles.metaLabel}>{row.email}</div>
        </div>
      )
    },
    { key: 'role', header: 'Requested Role', render: (row) => <span>{roleLabel(row.role)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status ?? 'pending'} />
          {row.status === 'approved' ? (
            <div className={coreStyles.metaLabel}>
              {row.inviteUsed ? 'Account created' : `Invite expires ${formatTimestamp(row.inviteExpiry)}`}
            </div>
          ) : null}
        </div>
      )
    },
    { key: 'createdAt', header: 'Requested', render: (row) => <span>{formatTimestamp(row.createdAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) =>
        canWriteRequests && row.id ? (
          <div className={coreStyles.inlineRow}>
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
                    done: `Invite sent to ${row.email}`
                  })
                }
                data-testid={`request-approve-btn-${row.email}`}
              >
                Approve
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
                    done: `New invite sent to ${row.email}`
                  })
                }
                data-testid={`request-resend-btn-${row.email}`}
              >
                Resend
              </Button>
            ) : null}
            {row.status !== 'rejected' && !row.inviteUsed ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<X size={14} />}
                onClick={() => {
                  setRejectTarget(row);
                  setRejectNote('');
                }}
                data-testid={`request-reject-btn-${row.email}`}
              >
                Reject
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              isLoading={isBusy(`delete-request-${row.id}`)}
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  key: `delete-request-${row.id}`,
                  run: () => deleteAccessRequest(row.id!),
                  done: `Request from ${row.email} removed`
                })
              }
              data-testid={`request-delete-btn-${row.email}`}
            >
              Remove
            </Button>
          </div>
        ) : (
          <span className={coreStyles.metaLabel}>View only</span>
        )
    }
  ];

  const deletedColumns: TableColumn<UserSummaryDto>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <strong>{row.name ?? row.username}</strong>
          <div className={coreStyles.metaLabel}>{row.email ?? EMPTY_VALUE}</div>
        </div>
      )
    },
    { key: 'role', header: 'Role', render: (row) => <span>{roleLabel(row.role)}</span> },
    { key: 'updatedAt', header: 'Deleted', render: (row) => <span>{formatTimestamp(row.updatedAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) =>
        row.id ? (
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
                done: `${row.username} restored`
              })
            }
            data-testid={`recycle-restore-btn-${row.username}`}
          >
            Restore
          </Button>
        ) : null
    }
  ];

  const users = usersQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const renderList = <T,>(
    query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown },
    caption: string,
    columns: TableColumn<T>[],
    data: T[],
    rowKey: (row: T) => string,
    emptyTitle: string
  ) => {
    if (query.isLoading) return <Skeleton label="Loading list" />;
    if (query.isError) {
      return (
        <ErrorState
          title="Could not load this list"
          description={errorText(query.error, 'Please try again.')}
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <Table caption={caption} columns={columns} data={data} rowKey={rowKey} emptyTitle={emptyTitle} />;
  };

  return (
    <div className={coreStyles.pageStack} data-testid="team-page">
      <PageHeader
        title="Team & Access"
        subtitle={
          canWriteUsers
            ? 'Manage who can use TraceX, what role they have, and new access requests.'
            : 'See who has access to TraceX and which access requests are waiting. Changes need an administrator.'
        }
        backdropKey="team"
        priority
      />

      <div className={coreStyles.tabBar} role="tablist" aria-label="Team views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`${coreStyles.tabBtn} ${tab === 'users' ? coreStyles.tabBtnActive : ''}`}
          onClick={() => setTab('users')}
          data-testid="team-tab-users"
        >
          Users ({users.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          className={`${coreStyles.tabBtn} ${tab === 'requests' ? coreStyles.tabBtnActive : ''}`}
          onClick={() => setTab('requests')}
          data-testid="team-tab-requests"
        >
          Access Requests ({pendingCount} pending)
        </button>
        {canSeeRecycleBin ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recycle'}
            className={`${coreStyles.tabBtn} ${tab === 'recycle' ? coreStyles.tabBtnActive : ''}`}
            onClick={() => setTab('recycle')}
            data-testid="team-tab-recycle"
          >
            Recycle Bin
          </button>
        ) : null}
      </div>

      <section className={coreStyles.sectionCard} role="tabpanel" data-testid={`team-panel-${tab}`}>
        {tab === 'users'
          ? renderList(usersQuery, 'Team members', userColumns, users, (r) => r.id ?? r.username ?? '', 'No team members yet')
          : null}
        {tab === 'requests'
          ? renderList(
              requestsQuery,
              'Access requests',
              requestColumns,
              requests,
              (r) => r.id ?? r.email ?? '',
              'No access requests'
            )
          : null}
        {tab === 'recycle' && canSeeRecycleBin
          ? renderList(
              deletedQuery,
              'Deleted users',
              deletedColumns,
              deletedQuery.data ?? [],
              (r) => r.id ?? r.username ?? '',
              'The recycle bin is empty'
            )
          : null}
      </section>

      <Dialog
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title={`Change role: ${roleTarget?.username ?? ''}`}
        description="The new role takes effect on the user's next request. They stay signed in."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRoleTarget(null)}>
              Cancel
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
                    done: `${target.username} is now ${roleLabel(newRole)}`
                  },
                  { onSuccess: () => setRoleTarget(null) }
                );
              }}
              data-testid="team-role-save-btn"
            >
              Save Role
            </Button>
          </>
        }
      >
        <Field label="New role" required>
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
        title={`Delete user: ${deleteTarget?.username ?? ''}`}
        description="The account is signed out and moved to the recycle bin. A super admin can restore it."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
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
                    done: `${target.username} moved to the recycle bin`
                  },
                  { onSuccess: () => setDeleteTarget(null) }
                );
              }}
              data-testid="team-delete-confirm-btn"
            >
              Delete User
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)">
          <Textarea
            value={deleteNote}
            onChange={(e) => setDeleteNote(e.target.value)}
            maxLength={500}
            rows={3}
            data-testid="team-delete-note"
          />
        </Field>
      </Dialog>

      <Dialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={`Reject request: ${rejectTarget?.email ?? ''}`}
        description="Any invite already sent for this request stops working."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
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
                    done: `Request from ${target.email} rejected`
                  },
                  { onSuccess: () => setRejectTarget(null) }
                );
              }}
              data-testid="request-reject-confirm-btn"
            >
              Reject Request
            </Button>
          </>
        }
      >
        <Field label="Note (optional)">
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            maxLength={500}
            rows={3}
            data-testid="request-reject-note"
          />
        </Field>
      </Dialog>
    </div>
  );
}
