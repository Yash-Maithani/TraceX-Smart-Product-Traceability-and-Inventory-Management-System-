import { Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { Button, EmptyState } from '../../components/ui';
import { STRINGS } from '../../strings/en';

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
