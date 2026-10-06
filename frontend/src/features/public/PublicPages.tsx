import { Link, useParams } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import {
  Button,
  EmptyState,
  OfflineBanner,
  PageBackdrop,
  SkipLink,
  ThemeToggle
} from '../../components/ui';
import { STRINGS } from '../../strings/en';

export function TracePlaceholderPage() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className={authStyles.authRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <header className={authStyles.authHeader}>
        <Link to="/login" className={authStyles.brandLink}>
          {STRINGS.app.name}
        </Link>
        <ThemeToggle />
      </header>
      <main id="main-content" tabIndex={-1}>
        <PageBackdrop backdropKey="trace-public" variant="full" priority>
          <section aria-labelledby="trace-page-heading">
            <h1 id="trace-page-heading" className={authStyles.authTitle}>
              {STRINGS.publicPages.tracePlaceholderTitle}
            </h1>
            <p className={authStyles.authSubtitle}>{`Lookup token: ${token ?? 'unknown'}`}</p>
            <p>{STRINGS.publicPages.tracePlaceholderBody}</p>
            <div className={authStyles.authFooterLinks}>
              <Link to="/login">{STRINGS.auth.backToLogin}</Link>
            </div>
          </section>
        </PageBackdrop>
      </main>
      <footer className={authStyles.pageFooter}>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Use</Link>
      </footer>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <AuthLayout
      title={STRINGS.publicPages.privacyTitle}
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      <p>{STRINGS.publicPages.privacyBody}</p>
    </AuthLayout>
  );
}

export function TermsPage() {
  return (
    <AuthLayout
      title={STRINGS.publicPages.termsTitle}
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      <p>{STRINGS.publicPages.termsBody}</p>
    </AuthLayout>
  );
}

export function NotFoundPage() {
  return (
    <AuthLayout
      title={STRINGS.states.notFoundTitle}
      footerLinks={<Link to="/">{STRINGS.states.backToHome}</Link>}
    >
      <EmptyState
        title={STRINGS.states.notFoundTitle}
        description={STRINGS.states.notFoundBody}
        action={
          <Link to="/">
            <Button variant="primary">{STRINGS.states.backToHome}</Button>
          </Link>
        }
      />
    </AuthLayout>
  );
}
