import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ClipboardCheck, LogIn, QrCode, Truck, UserPlus } from 'lucide-react';
import styles from './AuthLayout.module.css';
import { OfflineBanner, PageBackdrop, SkipLink, StatusBadge, ThemeToggle } from '../components/ui';
import { resolveBackdropKeyForPath, type BackdropKey } from '../routes/backdrops';
import { STRINGS } from '../strings/en';
import { AUTH_LAYOUT_STRINGS as A } from '../strings/authLayout';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footerLinks?: ReactNode;
  backdropKey?: BackdropKey;
  /** Long reading pages (legal, not found): photo band on top and a centred reading column. */
  wide?: boolean;
}

const FEATURE_ICONS = {
  trace: <ClipboardCheck size={18} aria-hidden="true" />,
  fefo: <Truck size={18} aria-hidden="true" />,
  qr: <QrCode size={18} aria-hidden="true" />
} as const;

/** The product preview on the photo: what TraceX does, real status names, and the two ways in. */
function ProductPreview() {
  return (
    <section className={styles.preview} aria-label={A.previewLabel} data-testid="auth-preview">
      <Link to="/" className={styles.wordmark}>
        {STRINGS.app.name}
      </Link>
      <h2 className={styles.previewHeading}>{A.heading}</h2>
      <p className={styles.previewLead}>{A.lead}</p>
      <ul className={styles.featureList}>
        {A.features.map((f) => (
          <li key={f.id}>
            <span className={styles.featureIcon}>{FEATURE_ICONS[f.id]}</span>
            {f.text}
          </li>
        ))}
      </ul>
      <div className={styles.statusPreview} role="group" aria-label={A.statusPreviewLabel}>
        <StatusBadge status="READY" />
        <StatusBadge status="URGENT" />
        <StatusBadge status="ON_HOLD" />
        <StatusBadge status="DISPATCHED" />
      </div>
      <nav className={styles.previewActions} aria-label={A.previewLabel}>
        <NavLink
          to="/login"
          className={({ isActive }) => `${styles.previewButton} ${styles.previewPrimary} ${isActive ? styles.previewCurrent : ''}`}
          data-testid="auth-preview-sign-in"
        >
          <LogIn size={16} aria-hidden="true" /> {A.signIn}
        </NavLink>
        <NavLink
          to="/request-access"
          className={({ isActive }) => `${styles.previewButton} ${styles.previewSecondary} ${isActive ? styles.previewCurrent : ''}`}
          data-testid="auth-preview-request-access"
        >
          <UserPlus size={16} aria-hidden="true" /> {A.requestAccess}
        </NavLink>
      </nav>
      <p className={styles.previewNote}>{A.newHere}</p>
    </section>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footerLinks,
  backdropKey,
  wide = false
}: AuthLayoutProps) {
  const location = useLocation();
  const resolvedKey = backdropKey ?? resolveBackdropKeyForPath(location.pathname);

  const card = (
    <section className={`${styles.authCard} ${wide ? styles.authCardWide : ''}`} aria-labelledby="auth-page-heading">
      <div>
        <h1 id="auth-page-heading" className={styles.authTitle}>
          {title}
        </h1>
        {subtitle ? <p className={styles.authSubtitle}>{subtitle}</p> : null}
      </div>
      {children}
      {footerLinks ? <div className={styles.authFooterLinks}>{footerLinks}</div> : null}
    </section>
  );

  const footer = (
    <footer className={styles.pageFooter}>
      <Link to="/privacy">{STRINGS.publicPages.privacyTitle}</Link>
      <Link to="/terms">{STRINGS.publicPages.termsTitle}</Link>
    </footer>
  );

  if (wide) {
    return (
      <div className={styles.authRoot}>
        <SkipLink targetId="main-content" />
        <OfflineBanner />
        <header className={styles.readingHeader}>
          <Link to="/" className={styles.brandLink}>
            {STRINGS.app.name}
          </Link>
          <ThemeToggle compact />
        </header>
        <PageBackdrop backdropKey={resolvedKey} variant="banner" className={styles.readingBand} />
        <main id="main-content" tabIndex={-1} className={styles.readingMain}>
          {card}
        </main>
        {footer}
      </div>
    );
  }

  return (
    <div className={styles.authRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <PageBackdrop backdropKey={resolvedKey} variant="side" priority mediaContent={<ProductPreview />}>
        <header className={styles.authHeader}>
          <Link to="/" className={styles.brandLink}>
            {STRINGS.app.name}
          </Link>
          <ThemeToggle compact />
        </header>
        <main id="main-content" tabIndex={-1} className={styles.authMain}>
          {card}
        </main>
        {footer}
      </PageBackdrop>
    </div>
  );
}

export { styles as authStyles };
