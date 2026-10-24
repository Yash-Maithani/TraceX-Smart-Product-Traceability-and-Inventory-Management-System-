import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout';
import { ButtonLink } from '../../components/ui';
import { STRINGS } from '../../strings/en';
import { authStyles } from '../../layouts/AuthLayout';
import { LEGAL_UPDATED, PHOTO_CREDITS, PRIVACY_SECTIONS, TERMS_SECTIONS, type LegalSection } from './legalContent';

const PHOTO_CREDITS_HEADING = 'Photo credits';

/** Anchor id for a section heading, e.g. "What we store" -> "what-we-store". */
function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function PhotoCredits() {
  return (
    <section className={authStyles.legalSection} data-testid="photo-credits" id={sectionId(PHOTO_CREDITS_HEADING)}>
      <h2>{PHOTO_CREDITS_HEADING}</h2>
      <p>The page photos are licensed from their photographers. They show real places and are not of TraceX staff, farms or products.</p>
      <ul>
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.key}>
            <a href={credit.sourceUrl} target="_blank" rel="noreferrer">
              {credit.source}
            </a>
            . Photo by {credit.author},{' '}
            <a href={credit.licenceUrl} target="_blank" rel="noreferrer">
              {credit.licence}
            </a>
            .
          </li>
        ))}
      </ul>
    </section>
  );
}

function LegalBody({
  sections,
  testId,
  extra,
  extraHeading
}: {
  sections: LegalSection[];
  testId: string;
  extra?: ReactNode;
  extraHeading?: string;
}) {
  const headings = [...sections.map((section) => section.heading), ...(extraHeading ? [extraHeading] : [])];
  return (
    <div data-testid={testId}>
      <nav className={authStyles.legalContents} aria-label="On this page" data-testid={`${testId}-contents`}>
        <h2>On this page</h2>
        <ol>
          {headings.map((heading) => (
            <li key={heading}>
              <a href={`#${sectionId(heading)}`}>{heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section) => (
        <section key={section.heading} className={authStyles.legalSection} id={sectionId(section.heading)}>
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
      {extra}
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
      <LegalBody
        sections={PRIVACY_SECTIONS}
        testId="privacy-content"
        extra={<PhotoCredits />}
        extraHeading={PHOTO_CREDITS_HEADING}
      />
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
    >
      <p className={authStyles.authSubtitle}>{STRINGS.states.notFoundBody}</p>
      <div>
        <ButtonLink to="/" variant="primary">
          {STRINGS.states.backToStart}
        </ButtonLink>
      </div>
    </AuthLayout>
  );
}
