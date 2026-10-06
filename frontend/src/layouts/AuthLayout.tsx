import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './AuthLayout.module.css';
import { OfflineBanner, PageBackdrop, SkipLink, ThemeToggle } from '../components/ui';
import { resolveBackdropKeyForPath, type BackdropKey } from '../routes/backdrops';
import { STRINGS } from '../strings/en';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footerLinks?: ReactNode;
  backdropKey?: BackdropKey;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footerLinks,
  backdropKey
}: AuthLayoutProps) {
  const location = useLocation();
  const resolvedKey = backdropKey ?? resolveBackdropKeyForPath(location.pathname);

  return (
    <div className={styles.authRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <PageBackdrop backdropKey={resolvedKey} variant="side" priority>
        <header className={styles.authHeader}>
          <Link to="/login" className={styles.brandLink}>
            {STRINGS.app.name}
          </Link>
          <ThemeToggle />
        </header>
        <main id="main-content" tabIndex={-1} className={styles.authMain}>
          <section className={styles.authCard} aria-labelledby="auth-page-heading">
            <div>
              <h1 id="auth-page-heading" className={styles.authTitle}>
                {title}
              </h1>
              {subtitle ? <p className={styles.authSubtitle}>{subtitle}</p> : null}
            </div>
            {children}
            {footerLinks ? <div className={styles.authFooterLinks}>{footerLinks}</div> : null}
          </section>
        </main>
        <footer className={styles.pageFooter}>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
        </footer>
      </PageBackdrop>
    </div>
  );
}

export { styles as authStyles };

