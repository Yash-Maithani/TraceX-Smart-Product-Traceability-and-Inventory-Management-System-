import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/endpoints';
import type { NotificationDto } from '../../api/types';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';

/** Where a notification's "Open" link goes, if anywhere. */
export function notificationLink(n: NotificationDto): string | null {
  if (n.refType === 'batch' && n.refId) return `/batches/${n.refId}`;
  if (n.refType === 'import') return '/import';
  if (n.refType === 'access_request') return '/team';
  return null;
}

/**
 * Notifications (Phase 10): the caller's own notifications from the last 7 days, newest first.
 */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const query = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: refresh
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async (res) => {
      await refresh();
      pushToast({ title: res.marked ? `${res.marked} marked as read` : 'Nothing left to mark', variant: 'success' });
    },
    onError: (err) =>
      pushToast({
        title: 'Could not mark notifications as read',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error'
      })
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unreadCount ?? 0;

  return (
    <div className={coreStyles.pageStack} data-testid="notifications-page">
      <PageHeader
        title="Notifications"
        subtitle="Updates about batches, inspections, dispatches, imports and access requests from the last 7 days."
        backdropKey="notifications"
        priority
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck size={15} />}
            disabled={unread === 0 || readAll.isPending}
            isLoading={readAll.isPending}
            onClick={() => readAll.mutate()}
            data-testid="notifications-read-all-btn"
          >
            Mark all as read
          </Button>
        }
      />

      <section className={coreStyles.sectionCard}>
        {query.isLoading ? (
          <Skeleton label="Loading notifications" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load notifications"
            description={query.error instanceof Error ? query.error.message : 'Please try again.'}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState title="No notifications" description="You're all caught up." />
        ) : (
          <ul className={coreStyles.timelineList} data-testid="notifications-list">
            {items.map((n) => {
              const link = notificationLink(n);
              return (
                <li
                  key={n.id}
                  className={coreStyles.timelineItem}
                  data-testid={`notification-${n.id}`}
                  data-read={n.read ? 'true' : 'false'}
                >
                  <div className={coreStyles.timelineHeader}>
                    <strong>
                      {n.read ? null : <span className="sr-only">Unread: </span>}
                      {n.title}
                    </strong>
                    <span className={coreStyles.metaLabel}>{formatTimestamp(n.createdAt)}</span>
                  </div>
                  <p>{n.message}</p>
                  <div className={coreStyles.inlineRow}>
                    {link ? (
                      <Link to={link} onClick={() => n.id && !n.read && readOne.mutate(n.id)}>
                        Open
                      </Link>
                    ) : null}
                    {!n.read && n.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => readOne.mutate(n.id!)}
                        disabled={readOne.isPending}
                        data-testid={`notification-read-btn-${n.id}`}
                      >
                        Mark as read
                      </Button>
                    ) : (
                      <span className={coreStyles.metaLabel}>Read</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
