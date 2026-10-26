import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import publicStyles from './public.module.css';
import { ApiError } from '../../api/client';
import { fetchPublicTrace, recordPublicScan } from '../../api/endpoints';
import { ClipboardCheck, Package, RefreshCw, ShieldCheck, Sprout, Truck } from 'lucide-react';
import {
  Button,
  OfflineBanner,
  PageBackdrop,
  Skeleton,
  SkipLink,
  StatusBadge,
  ThemeToggle,
  Timeline,
  type StatusBadgeValue,
  type TimelineEntry,
  type TimelineTone
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { logger } from '../../lib/logger';
import { STRINGS } from '../../strings/en';
import { TRACE_STRINGS as T } from '../../strings/trace';
import { ReportProblemForm } from './ReportProblemForm';

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

  const journey: TimelineEntry[] = traceData
    ? [
        {
          id: 'collected',
          icon: <Sprout size={14} />,
          iconLabel: T.steps.collectedUnknown,
          title: traceData.village ? T.steps.collected(traceData.village) : T.steps.collectedUnknown,
          tone: 'neutral' as const
        },
        {
          id: 'packed',
          icon: <Package size={14} />,
          iconLabel: T.steps.packed,
          title: T.steps.packed,
          time: traceData.packDate ? formatBusinessDate(traceData.packDate) : T.notRecorded
        },
        ...(traceData.qualityCheck?.status
          ? [
              {
                id: 'inspected',
                icon: <ClipboardCheck size={14} />,
                iconLabel: T.steps.inspected(T.verdicts[traceData.qualityCheck.status] ?? traceData.qualityCheck.status),
                title: T.steps.inspected(T.verdicts[traceData.qualityCheck.status] ?? traceData.qualityCheck.status),
                time: traceData.qualityCheck.inspectedAt ? formatTimestamp(traceData.qualityCheck.inspectedAt) : undefined,
                tone: (traceData.qualityCheck.status === 'PASSED'
                  ? 'success'
                  : traceData.qualityCheck.status === 'FAILED'
                    ? 'danger'
                    : 'warning') as TimelineTone
              }
            ]
          : []),
        ...(traceData.status === 'DISPATCHED'
          ? [{ id: 'dispatched', icon: <Truck size={14} />, iconLabel: T.steps.dispatched, title: T.steps.dispatched, tone: 'info' as const }]
          : [])
      ]
    : [];

  return (
    <div className={publicStyles.publicRoot}>
      <SkipLink targetId="main-content" />
      <OfflineBanner />
      <header className={publicStyles.publicHeader}>
        <Link to="/" className={publicStyles.brandLink}>
          {STRINGS.app.name}
        </Link>
        <ThemeToggle compact />
      </header>

      <main id="main-content" tabIndex={-1} className={publicStyles.publicMain}>
        <PageBackdrop backdropKey="trace-public" variant="full" priority>
          <div className={publicStyles.traceCard}>
            {traceQuery.isPending ? (
              <Skeleton label={T.loading} />
            ) : isNotFound ? (
              <div className={publicStyles.plainState} data-testid="trace-404-state">
                <h1 className={publicStyles.productHeading}>{T.notFoundTitle}</h1>
                <p className={publicStyles.lead}>{T.notFoundBody}</p>
              </div>
            ) : traceQuery.isError ? (
              <div className={publicStyles.plainState} data-testid="trace-error-state">
                <h1 className={publicStyles.productHeading}>{T.errorTitle}</h1>
                <p className={publicStyles.lead}>{traceQuery.error instanceof Error ? traceQuery.error.message : T.errorBody}</p>
                <div>
                  <Button variant="secondary" leftIcon={<RefreshCw size={15} />} onClick={() => void traceQuery.refetch()}>
                    {STRINGS.common.retry}
                  </Button>
                </div>
              </div>
            ) : traceData ? (
              <>
                <div className={publicStyles.traceTop}>
                  <h1 className={publicStyles.productHeading} data-testid="trace-product-name">
                    {traceData.productName}
                  </h1>
                  <p className={publicStyles.verified}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>
                      {T.verified}{' '}
                      <span className={publicStyles.batchCode} data-testid="trace-batch-code">
                        {traceData.batchCode}
                      </span>
                    </span>
                  </p>
                </div>

                <dl className={publicStyles.keyFacts}>
                  <div className={publicStyles.keyFact}>
                    <dt>{T.bestBefore}</dt>
                    <dd className={publicStyles.keyValue} data-testid="trace-expiry-date">
                      {traceData.expiryDate ? formatBusinessDate(traceData.expiryDate) : T.notRecorded}
                    </dd>
                    {traceData.status ? (
                      <dd className={publicStyles.statusLine} data-testid="trace-status-badge">
                        {T.status[traceData.status] ?? traceData.status}
                      </dd>
                    ) : null}
                  </div>
                  <div className={publicStyles.keyFact}>
                    <dt>{T.packed}</dt>
                    <dd className={publicStyles.keyValue} data-testid="trace-pack-date">
                      {traceData.packDate ? formatBusinessDate(traceData.packDate) : T.notRecorded}
                    </dd>
                  </div>
                  <div className={publicStyles.keyFact}>
                    <dt>{T.origin}</dt>
                    <dd className={publicStyles.keyValue} data-testid="trace-village">
                      {traceData.village}
                    </dd>
                  </div>
                  <div className={publicStyles.keyFact}>
                    <dt>{T.productCode}</dt>
                    <dd className={publicStyles.keyValueMono} data-testid="trace-sku">
                      {traceData.sku}
                    </dd>
                  </div>
                </dl>

                {traceData.qualityCheck ? (
                  <section className={publicStyles.subSection} data-testid="trace-quality-section">
                    <div className={publicStyles.qualityRow}>
                      {traceData.qualityCheck.status ? (
                        <span data-testid="trace-quality-status">
                          <StatusBadge status={traceData.qualityCheck.status as StatusBadgeValue} />
                        </span>
                      ) : null}
                      <span data-testid="trace-quality-rating">{T.rating(traceData.qualityCheck.rating)}</span>
                      <span data-testid="trace-quality-date" className={publicStyles.muted}>
                        {traceData.qualityCheck.inspectedAt ? formatTimestamp(traceData.qualityCheck.inspectedAt) : ''}
                      </span>
                    </div>
                  </section>
                ) : null}

                {traceData.ingredients || traceData.storageInstructions || (traceData.allergens?.length ?? 0) > 0 ? (
                  <section className={publicStyles.subSection} aria-labelledby="trace-label-heading" data-testid="trace-label-section">
                    <h2 id="trace-label-heading" className={publicStyles.sectionHeading}>
                      {T.label.heading}
                    </h2>
                    <dl className={publicStyles.labelList}>
                      <div>
                        <dt>{T.label.allergens}</dt>
                        <dd>
                          {traceData.allergens && traceData.allergens.length > 0 ? (
                            <ul className={publicStyles.allergenList} data-testid="trace-allergens">
                              {traceData.allergens.map((a) => (
                                <li key={a} className={publicStyles.allergenTag}>
                                  {a}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span data-testid="trace-allergens-none">{T.label.noAllergens}</span>
                          )}
                        </dd>
                      </div>
                      {traceData.ingredients ? (
                        <div>
                          <dt>{T.label.ingredients}</dt>
                          <dd data-testid="trace-ingredients">{traceData.ingredients}</dd>
                        </div>
                      ) : null}
                      {traceData.storageInstructions ? (
                        <div>
                          <dt>{T.label.storage}</dt>
                          <dd data-testid="trace-storage">{traceData.storageInstructions}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>
                ) : null}

                <section className={publicStyles.subSection} aria-labelledby="trace-journey-heading">
                  <h2 id="trace-journey-heading" className={publicStyles.sectionHeading}>
                    {T.journeyTitle}
                  </h2>
                  <Timeline entries={journey} label={T.journeyLabel} testId="trace-journey" />
                </section>

                {traceData.traceabilityNote ? (
                  <section className={publicStyles.subSection} data-testid="trace-note-section">
                    <h2 className={publicStyles.sectionHeading}>{T.noteTitle}</h2>
                    <p className={publicStyles.noteText} data-testid="trace-note">
                      {traceData.traceabilityNote}
                    </p>
                  </section>
                ) : null}

                <ReportProblemForm token={token} />
              </>
            ) : null}
          </div>
        </PageBackdrop>
      </main>

      <footer className={publicStyles.publicFooter}>
        <span>{T.copyright(new Date().getFullYear())}</span>
        <nav className={publicStyles.footerLinks} aria-label={T.footerLabel}>
          <Link to="/privacy">{STRINGS.publicPages.privacyTitle}</Link>
          <Link to="/terms">{STRINGS.publicPages.termsTitle}</Link>
        </nav>
      </footer>
    </div>
  );
}
