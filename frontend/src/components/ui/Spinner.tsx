import styles from './ui.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading…' }: SpinnerProps) {
  const sizeClass =
    size === 'sm' ? styles.spinnerSm : size === 'lg' ? styles.spinnerLg : styles.spinnerMd;

  return (
    <span role="status" aria-live="polite" className={styles.spinnerWrap}>
      <span className={`${styles.spinner} ${sizeClass}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface SkeletonProps {
  className?: string | undefined;
  label?: string | undefined;
}

export function Skeleton({ className, label = 'Loading content' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`${styles.skeleton} ${className ?? ''}`}
    />
  );
}
