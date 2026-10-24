import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  FileUp,
  LayoutDashboard,
  LogIn,
  PackagePlus,
  QrCode,
  ScanLine,
  Truck,
  UserPlus
} from 'lucide-react';
import styles from './home.module.css';
import { ButtonLink, OfflineBanner, PageBackdrop, SkipLink, StatusBadge, ThemeToggle } from '../../components/ui';
import { STRINGS } from '../../strings/en';
import { HOME_STRINGS as H } from '../../strings/home';

const STEP_ICONS: Record<(typeof H.how.steps)[number]['id'], ReactNode> = {
  record: <PackagePlus size={20} aria-hidden="true" />,
  inspect: <ClipboardCheck size={20} aria-hidden="true" />,
  dispatch: <Truck size={20} aria-hidden="true" />,
  scan: <ScanLine size={20} aria-hidden="true" />
};

const INSIDE_ICONS: Record<(typeof H.inside.items)[number]['id'], ReactNode> = {
  dashboard: <LayoutDashboard size={20} aria-hidden="true" />,
  batches: <Boxes size={20} aria-hidden="true" />,
  fefo: <Truck size={20} aria-hidden="true" />,
  inspections: <ClipboardCheck size={20} aria-hidden="true" />,
  import: <FileUp size={20} aria-hidden="true" />,
  qr: <QrCode size={20} aria-hidden="true" />
};

function AccessButtons({ onPhoto = false }: { onPhoto?: boolean }) {
  return (
    <div className={styles.actions}>
      <ButtonLink
        to="/login"
        variant="primary"
        size="lg"
        leftIcon={<LogIn size={18} aria-hidden="true" />}
        data-testid={onPhoto ? 'home-hero-sign-in' : undefined}
      >
        {H.signIn}
      </ButtonLink>
      <Link
        to="/request-access"
        className={onPhoto ? styles.photoSecondary : styles.plainSecondary}
        data-testid={onPhoto ? 'home-hero-request-access' : undefined}
      >
        <UserPlus size={18} aria-hidden="true" />
        {H.requestAccess}
      </Link>
    </div>
  );
}

/**
 * Public home page (redesign R4.1): what a visitor sees at `/` before signing in.
 * Signed-in users never see it; RequireAuth shows the dashboard at `/` instead.
 */
export function HomePage() {
  const year = new Date().getFullYear();

  return (
    <div className={styles.homeRoot} data-testid="home-page">
      <SkipLink targetId="main-content" />
      <OfflineBanner />

      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link to="/" className={styles.brand}>
            {STRINGS.app.name}
          </Link>
          <nav className={styles.sectionNav} aria-label={H.navLabel}>
            <a href="#how">{H.nav.how}</a>
            <a href="#inside">{H.nav.inside}</a>
            <a href="#roles">{H.nav.roles}</a>
          </nav>
          <div className={styles.topBarEnd}>
            <ThemeToggle compact />
            <ButtonLink to="/login" variant="primary" size="sm" data-testid="home-header-sign-in">
              {H.signIn}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <PageBackdrop backdropKey="auth" variant="banner" priority className={styles.hero} testId="home-hero">
          <div className={styles.heroCopy}>
            <h1 className={styles.heroHeading}>{H.hero.heading}</h1>
            <p className={styles.heroLead}>{H.hero.lead}</p>
            <p className={styles.heroPlace}>{H.hero.place}</p>
            <AccessButtons onPhoto />
          </div>
        </PageBackdrop>

        <section id="how" className={styles.section} aria-labelledby="home-how">
          <div className={styles.sectionInner}>
            <h2 id="home-how" className={styles.sectionHeading}>
              {H.how.heading}
            </h2>
            <p className={styles.sectionLead}>{H.how.lead}</p>
            <ol className={styles.steps}>
              {H.how.steps.map((step, index) => (
                <li key={step.id} className={styles.step}>
                  <div className={styles.stepTop}>
                    <span className={styles.iconBox}>{STEP_ICONS[step.id]}</span>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{step.title}</h3>
                  <p className={styles.cardText}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="inside" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="home-inside">
          <div className={styles.sectionInner}>
            <h2 id="home-inside" className={styles.sectionHeading}>
              {H.inside.heading}
            </h2>
            <p className={styles.sectionLead}>{H.inside.lead}</p>
            <ul className={styles.featureGrid}>
              {H.inside.items.map((item) => (
                <li key={item.id} className={styles.feature}>
                  <span className={styles.iconBox}>{INSIDE_ICONS[item.id]}</span>
                  <div>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    <p className={styles.cardText}>{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.statusPanel}>
              <h3 className={styles.cardTitle}>{H.inside.statusHeading}</h3>
              <div className={styles.statusRow}>
                <StatusBadge status="READY" />
                <StatusBadge status="WARNING" />
                <StatusBadge status="URGENT" />
                <StatusBadge status="EXPIRED" />
                <StatusBadge status="ON_HOLD" />
                <StatusBadge status="DISPATCHED" />
              </div>
              <p className={styles.cardText}>{H.inside.statusNote}</p>
            </div>
          </div>
        </section>

        <section id="roles" className={styles.section} aria-labelledby="home-roles">
          <div className={styles.sectionInner}>
            <h2 id="home-roles" className={styles.sectionHeading}>
              {H.roles.heading}
            </h2>
            <p className={styles.sectionLead}>{H.roles.lead}</p>
            <ul className={styles.roleList}>
              {H.roles.items.map((role) => (
                <li key={role.id} className={styles.role}>
                  <span className={styles.roleName}>{STRINGS.roles[role.id]}</span>
                  <span className={styles.cardText}>{role.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.ctaSection} aria-labelledby="home-cta">
          <div className={styles.cta}>
            <div>
              <h2 id="home-cta" className={styles.ctaHeading}>
                {H.cta.heading}
              </h2>
              <p className={styles.cardText}>{H.cta.text}</p>
            </div>
            <AccessButtons />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerAbout}>
            <Link to="/" className={styles.brand}>
              {STRINGS.app.name}
            </Link>
            <p className={styles.cardText}>{H.footer.about}</p>
          </div>
          <nav className={styles.footerLinks} aria-label={H.footer.linksLabel}>
            <Link to="/login">
              {H.signIn} <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/request-access">{H.requestAccess}</Link>
            <Link to="/privacy">{STRINGS.publicPages.privacyTitle}</Link>
            <Link to="/terms">{STRINGS.publicPages.termsTitle}</Link>
          </nav>
        </div>
        <p className={styles.copyright}>{H.footer.copyright(year)}</p>
      </footer>
    </div>
  );
}
