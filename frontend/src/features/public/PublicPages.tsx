import { Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { Button, EmptyState } from '../../components/ui';
import { STRINGS } from '../../strings/en';
import { authStyles } from '../../layouts/AuthLayout';
import { LEGAL_UPDATED, PRIVACY_SECTIONS, TERMS_SECTIONS, type LegalSection } from './legalContent';

function LegalBody({ sections, testId }: { sections: LegalSection[]; testId: string }) {
  return (
    <div data-testid={testId}>
      {sections.map((section) => (
        <section key={section.heading} className={authStyles.legalSection}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {section.items ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <p className={authStyles.legalUpdated}>Last updated {LEGAL_UPDATED}.</p>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <AuthLayout
      title={STRINGS.publicPages.privacyTitle}
      subtitle="What TraceX stores, why, for how long, and who can see it."
      wide
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      <LegalBody sections={PRIVACY_SECTIONS} testId="privacy-content" />
    </AuthLayout>
  );
}

export function TermsPage() {
  return (
    <AuthLayout
      title={STRINGS.publicPages.termsTitle}
      subtitle="The rules for using TraceX."
      wide
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      <LegalBody sections={TERMS_SECTIONS} testId="terms-content" />
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
