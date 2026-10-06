import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './ui.module.css';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  iconOnly?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.buttonPrimary ?? '',
  secondary: styles.buttonSecondary ?? '',
  ghost: styles.buttonGhost ?? '',
  danger: styles.buttonDanger ?? ''
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.buttonSm ?? '',
  md: styles.buttonMd ?? '',
  lg: styles.buttonLg ?? ''
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    isLoading = false,
    loadingText,
    fullWidth = false,
    iconOnly = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    type = 'button',
    children,
    ...rest
  } = props;

  const busy = Boolean(loading || isLoading);

  const classes = [
    styles.button,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    iconOnly ? styles.buttonIconOnly : '',
    fullWidth ? styles.buttonFullWidth : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={classes}
      {...rest}
    >
      {busy ? <Spinner size="sm" label={loadingText ?? 'Loading'} /> : leftIcon}
      {busy && loadingText ? <span>{loadingText}</span> : children}
      {!busy && rightIcon}
    </button>
  );
});
