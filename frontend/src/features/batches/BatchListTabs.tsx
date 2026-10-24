import { NavLink } from 'react-router-dom';
import styles from './batches.module.css';
import { useAuth } from '../../auth/AuthContext';
import { canViewArchivedBatches } from '../../auth/permissions.generated';
import { BATCH_STRINGS as S } from '../../strings/batches';

/**
 * Active / Archived switch above the batch lists (DESIGN.md §6.5). These are two pages, so they are
 * links with aria-current, not ARIA tabs. Roles that cannot see archived batches get no switch.
 */
export function BatchListTabs() {
  const { user } = useAuth();
  if (!canViewArchivedBatches(user)) return null;
  return (
    <nav aria-label={S.tabsLabel} className={styles.listTabs}>
      <NavLink to="/batches" end className={({ isActive }) => `${styles.listTab} ${isActive ? styles.listTabActive : ''}`}>
        {S.tabActive}
      </NavLink>
      <NavLink
        to="/batches/archived"
        className={({ isActive }) => `${styles.listTab} ${isActive ? styles.listTabActive : ''}`}
        data-testid="view-archived-batches-btn"
      >
        {S.tabArchived}
      </NavLink>
    </nav>
  );
}
