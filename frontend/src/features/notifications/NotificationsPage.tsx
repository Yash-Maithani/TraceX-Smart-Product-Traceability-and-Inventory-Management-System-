import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './notifications.module.css';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/endpoints';
import type { NotificationDto } from '../../api/types';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { NOTIFICATION_STRINGS as S } from '../../strings/inbox';

/** Where a notification's "Open" link goes, if anywhere. */
export function notificationLink(n: NotificationDto): string | null {
  if (n.refType === 'batch' && n.refId) return `/batches/${n.refId}`;
  if (n.refType === 'import') return '/import';
  if (n.refType === 'access_request') return '/team?tab=requests';
  return null;
}

/** Groups notifications by the reader's local calendar day: Today, Yesterday, then the date. */
export function groupByDay(items: NotificationDto[], now: Date = new Date()): { label: string; items: NotificationDto[] }[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yesterday = dayKey(y);
  const groups: { key: string; label: string; items: NotificationDto[] }[] = [];
  for (const n of items) {
    const created = n.createdAt ? new Date(n.createdAt) : null;
    const key = created && !Number.isNaN(created.getTime()) ? dayKey(created) : 'unknown';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label =
        key === today
          ? S.today
          : key === yesterday
            ? S.yesterday
            : created && !Number.isNaN(created.getTime())
              ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(created)
              : '';
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(n);
  }
  return groups;
}

/**
 * Notifications (Phase 10, redesigned in R2): the caller's own notifications from the last 7 days,
 * newest first, grouped by day.
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
      pushToast({ title: res.marked ? S.markedToast(res.marked) : S.nothingToMark, variant: 'success' });
    },
    onError: (err) =>
      pushToast({
        title: S.markFailed,
        description: err instanceof Error ? err.message : undefined,
        variant: 'error'
      })
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unreadCount ?? 0;

  return (
    <div className={styles.page} data-testid="notifications-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={unread > 0 ? <span className={styles.unreadChip}>{S.unreadCount(unread)}</span> : undefined}
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
            {S.markAll}
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton label={S.loading} className={styles.skeleton} />
      ) : query.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={query.error instanceof Error ? query.error.message : S.errorBody}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState title={S.emptyTitle} description={S.emptyBody} />
      ) : (
        <div className={styles.groups} data-testid="notifications-list">
          {groupByDay(items).map((group) => (
            <section key={group.label} aria-label={group.label} className={styles.group}>
              <h2 className={styles.groupHeading}>{group.label}</h2>
              <ul className={styles.list}>
                {group.items.map((n) => {
                  const link = notificationLink(n);
                  return (
                    <li
                      key={n.id}
                      className={`${styles.item} ${n.read ? '' : styles.itemUnread}`}
                      data-testid={`notification-${n.id}`}
                      data-read={n.read ? 'true' : 'false'}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <div className={styles.body}>
                        <div className={styles.head}>
                          <span className={styles.itemTitle}>
                            {n.read ? null : <span className="sr-only">{S.unreadPrefix}</span>}
                            {n.title}
                          </span>
                          <span className={styles.time}>{formatTimestamp(n.createdAt)}</span>
                        </div>
                        {n.message ? <p className={styles.message}>{n.message}</p> : null}
                        <div className={styles.actions}>
                          {link ? (
                            <Link
                              to={link}
                              className={styles.open}
                              onClick={() => n.id && !n.read && readOne.mutate(n.id)}
                            >
                              {S.open}
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
                              {S.markOne}
                            </Button>
                          ) : (
                            <span className={styles.readLabel}>{S.read}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
