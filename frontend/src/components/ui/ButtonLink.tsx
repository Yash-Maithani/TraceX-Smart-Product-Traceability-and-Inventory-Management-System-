import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './ui.module.css';
import type { ButtonSize, ButtonVariant } from './Button';

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  className?: string;
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

/** A link that looks like a button, so navigation is not a button nested inside a link. */
export function ButtonLink({ variant = 'secondary', size = 'md', leftIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={[styles.button, VARIANT_CLASS[variant], SIZE_CLASS[size], className ?? ''].filter(Boolean).join(' ')}
    >
      {leftIcon}
      {children}
    </Link>
  );
}
