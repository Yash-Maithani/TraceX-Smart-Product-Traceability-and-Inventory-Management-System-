import styles from './ui.module.css';
import { STATUS_BADGE_MAP, type StatusBadgeValue } from './statusMap';

export type { StatusBadgeValue };

export interface StatusBadgeProps {
  status: StatusBadgeValue;
  labelOverride?: string;
}

export function StatusBadge({ status, labelOverride }: StatusBadgeProps) {
  const cfg = STATUS_BADGE_MAP[status] ?? STATUS_BADGE_MAP.EXCEPTION;
  const Icon = cfg.Icon;
  const text = labelOverride ?? cfg.label;

  return (
    <span className={`${styles.badge} ${cfg.toneClass}`} data-status={status}>
      <Icon size={13} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
