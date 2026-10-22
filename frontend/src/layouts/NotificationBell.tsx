import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './AppShell.module.css';
import { fetchNotifications } from '../api/endpoints';

/** Top-bar bell with the unread count (Phase 10). Live events refresh it through ['notifications']. */
export function NotificationBell() {
  const query = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
  const unread = query.data?.unreadCount ?? 0;
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <Link to="/notifications" className={styles.bellLink} aria-label={label} data-testid="notification-bell">
      <Bell size={18} aria-hidden="true" />
      {unread > 0 ? (
        <span className={styles.bellBadge} data-testid="notification-bell-count" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
