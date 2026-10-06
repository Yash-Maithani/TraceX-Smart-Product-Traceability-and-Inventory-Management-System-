import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import publicStyles from './public.module.css';
import { ApiError } from '../../api/client';
import { fetchPublicTrace, recordPublicScan } from '../../api/endpoints';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  PageBackdrop,
  Skeleton,
  SkipLink,
  StatusBadge,
  ThemeToggle,
  type StatusBadgeValue
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { logger } from '../../lib/logger';
import { STRINGS } from '../../strings/en';

export function PublicTracePage() {
  const { token = '' } = useParams<{ token: string }>();
  const scanFiredRef = useRef(false);

  // Robots noindex, nofollow while mounted (restored on leave)
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    const previousContent = meta ? meta.getAttribute('content') : null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
      created = true;
    }
    meta.setAttribute('content', 'noindex, nofollow');

    return () => {
      if (created && meta) {
        meta.remove();
      } else if (meta) {
        if (previousContent !== null) {
          meta.setAttribute('content', previousContent);
        } else {
          meta.removeAttribute('content');
        }
      }
    };
  }, []);

  const traceQuery = useQuery({
    queryKey: ['publicTrace', token],
    queryFn: () => fetchPublicTrace(token),
    enabled: Boolean(token),
    retry: false
  });

  const traceData = traceQuery.data;

  // Fire scan recording once per page load after successful data load
  useEffect(() => {
    if (traceData && !scanFiredRef.current && token) {
      scanFiredRef.current = true;
      recordPublicScan({ token, source: 'buyer' }).catch((err) => {
        // Silently catch scan errors: must never break page or show toast
        logger.warn('Scan recording failed silently', { error: String(err) });
      });
    }
  }, [traceData, token]);

  const isNotFound =
    traceQuery.isError &&
    traceQuery.error instanceof ApiError &&
    traceQuery.error.status === 404;

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
        <PageBackdrop backdropKey="trace-public" variant="full" priority>
          <div className={publicStyles.traceCard}>
            {traceQuery.isPending ? (
              <Skeleton label="Loading batch traceability details" />
            ) : isNotFound ? (
              <div data-testid="trace-404-state">
                <EmptyState
                  title="Batch Not Found or Unavailable"
                  description="This QR link is not valid or the batch is no longer available."
                />
              </div>
            ) : traceQuery.isError ? (
              <div data-testid="trace-error-state">
                <ErrorState
                  title="Unable to load trace data"
                  description={
                    traceQuery.error instanceof Error
                      ? traceQuery.error.message
                      : 'Network error occurred. Please try again.'
                  }
                  onRetry={() => void traceQuery.refetch()}
                />
              </div>
            ) : traceData ? (
              <>
                <div className={publicStyles.cardHeader}>
                  <div>
                    <h1 className={publicStyles.batchCodeTitle} data-testid="trace-batch-code">
                      {traceData.batchCode}
                    </h1>
                    <p className={publicStyles.productTitle} data-testid="trace-product-name">
                      {traceData.productName}
                    </p>
                  </div>
                  <div data-testid="trace-status-badge">
                    {traceData.status ? (
                      <StatusBadge
                        status={traceData.status as StatusBadgeValue}
                      />
                    ) : null}
                  </div>
                </div>

                <div className={publicStyles.fieldsGrid}>
                  <div className={publicStyles.fieldItem}>
                    <span className={publicStyles.fieldLabel}>SKU</span>
                    <span className={publicStyles.fieldValue} data-testid="trace-sku">
                      {traceData.sku}
                    </span>
                  </div>

                  <div className={publicStyles.fieldItem}>
                    <span className={publicStyles.fieldLabel}>Origin Village</span>
                    <span className={publicStyles.fieldValue} data-testid="trace-village">
                      {traceData.village}
                    </span>
                  </div>

                  <div className={publicStyles.fieldItem}>
                    <span className={publicStyles.fieldLabel}>Pack Date</span>
                    <span className={publicStyles.fieldValue} data-testid="trace-pack-date">
                      {traceData.packDate ? formatBusinessDate(traceData.packDate) : '—'}
                    </span>
                  </div>

                  <div className={publicStyles.fieldItem}>
                    <span className={publicStyles.fieldLabel}>Expiry Date</span>
                    <span className={publicStyles.fieldValue} data-testid="trace-expiry-date">
                      {traceData.expiryDate ? formatBusinessDate(traceData.expiryDate) : '—'}
                    </span>
                  </div>
                </div>

                {traceData.qualityCheck ? (
                  <div className={publicStyles.qualitySection} data-testid="trace-quality-section">
                    <h2 className={publicStyles.sectionHeading}>Quality Inspection</h2>
                    <div className={coreStyles.inlineRow}>
                      {traceData.qualityCheck.status ? (
                        <span data-testid="trace-quality-status">
                          <StatusBadge
                            status={traceData.qualityCheck.status as StatusBadgeValue}
                          />
                        </span>
                      ) : null}
                      <span data-testid="trace-quality-rating">
                        Rating: {traceData.qualityCheck.rating}/5
                      </span>
                      <span data-testid="trace-quality-date" className={coreStyles.metaLabel}>
                        {traceData.qualityCheck.inspectedAt
                          ? formatTimestamp(traceData.qualityCheck.inspectedAt)
                          : ''}
                      </span>
                    </div>
                  </div>
                ) : null}

                {traceData.traceabilityNote ? (
                  <div className={publicStyles.noteSection} data-testid="trace-note-section">
                    <h2 className={publicStyles.sectionHeading}>Traceability Note</h2>
                    <p className={publicStyles.noteText} data-testid="trace-note">
                      {traceData.traceabilityNote}
                    </p>
                  </div>
                ) : null}
              </>
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
