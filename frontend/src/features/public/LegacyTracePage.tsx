import { Link, useParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import publicStyles from './public.module.css';
import {
  Button,
  EmptyState,
  OfflineBanner,
  PageBackdrop,
  SkipLink,
  ThemeToggle
} from '../../components/ui';
import { STRINGS } from '../../strings/en';

export function LegacyTracePage() {
  const { code = '' } = useParams<{ code: string }>();

  return (
    <div className={publicStyles.publicRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <header className={publicStyles.publicHeader}>
        <Link to="/login" className={publicStyles.brandLink}>
          {STRINGS.app.name}
        </Link>
        <ThemeToggle />
      </header>

      <main id="main-content" tabIndex={-1} className={publicStyles.publicMain}>
        <PageBackdrop backdropKey="trace-public" variant="full">
          <div className={publicStyles.traceCard}>
            <div data-testid="legacy-trace-deprecation">
              <EmptyState
                title="This Link Format is No Longer Supported"
                description="Public trace links are now secured with tamper-proof cryptographic tokens. Direct batch code lookup URLs have been deprecated. Please scan the official printed QR code on the packaging to access the authentic traceability record."
                action={
                  <Link to="/login">
                    <Button variant="primary">Return to Sign In</Button>
                  </Link>
                }
              />
            </div>
            {code ? (
              <div className={coreStyles.metaLabel}>
                Batch code requested: {code}
              </div>
            ) : null}
          </div>
        </PageBackdrop>
      </main>

      <footer className={publicStyles.publicFooter}>
        <span>&copy; {new Date().getFullYear()} TraceX Traceability</span>
        <div className={coreStyles.filterActionGroup}>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}
