import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, CircleX, ClipboardCheck, Lock, Plus, RefreshCw, Truck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './dashboard.module.css';
import { ApiError } from '../../api/client';
import { fetchDashboardSummary } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { canCreateBatch, canViewFefoQueue, canViewInspections } from '../../auth/permissions.generated';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeader,
  ShelfLifeRail,
  Skeleton,
  StatCard,
  StatusBadge,
  type StatusBadgeValue
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { STRINGS } from '../../strings/en';
import { STATUS_STRINGS } from '../../strings/status';
import { DASHBOARD_STRINGS as S } from '../../strings/dashboard';

type TierField = 'ready' | 'warning' | 'urgent' | 'expired' | 'exception';

/** Freshest to oldest, so the bar reads left to right like shelf life running out. */
const STOCK_SEGMENTS: readonly { tier: StatusBadgeValue; field: TierField; tone: string }[] = [
  { tier: 'READY', field: 'ready', tone: styles.segSuccess ?? '' },
  { tier: 'WARNING', field: 'warning', tone: styles.segWarning ?? '' },
  { tier: 'URGENT', field: 'urgent', tone: styles.segUrgent ?? '' },
  { tier: 'EXPIRED', field: 'expired', tone: styles.segDanger ?? '' },
  { tier: 'EXCEPTION', field: 'exception', tone: styles.segNeutral ?? '' }
];

const VERDICTS = ['PASSED', 'FLAGGED', 'FAILED', 'none'] as const;

export function DashboardPage() {
  const { user, refreshSession } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary
  });

  const summary = summaryQuery.data;
  const totalActive = summary?.totalActive ?? 0;
  const totalAll = totalActive + (summary?.dispatched ?? 0);
  const roleLabel = user?.role ? (STRINGS.roles[user.role] ?? user.role) : '';
  const mayCreate = canCreateBatch(user);
  const mayViewQueue = canViewFefoQueue(user);

  const signedIn = user ? (
    <span className={styles.signedIn}>
      {S.signedInAs} <strong data-testid="home-user-name">{user.name}</strong>{' '}
      (<span className={styles.mono} data-testid="home-user-username">{user.username}</span>),{' '}
      <span data-testid="home-user-role">{roleLabel}</span>
    </span>
  ) : null;

  return (
    <div className={styles.page} data-testid="dashboard-page">
      <PageHeader
        title={S.title}
        subtitle={summary?.businessDate ? S.asOf(formatBusinessDate(summary.businessDate)) : S.asOfPending}
        meta={signedIn}
        backdropKey="dashboard"
        priority
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={15} />}
              onClick={() => {
                void refreshSession();
                void summaryQuery.refetch();
              }}
              data-testid="verify-session-btn"
            >
              {S.refresh}
            </Button>
            {mayViewQueue ? (
              <ButtonLink to="/fefo" variant={mayCreate ? 'secondary' : 'primary'} size="sm" leftIcon={<Truck size={15} aria-hidden="true" />}>
                {S.openQueue}
              </ButtonLink>
            ) : null}
            {mayCreate ? (
              <ButtonLink to="/batches/new" variant="primary" size="sm" leftIcon={<Plus size={15} aria-hidden="true" />}>
                {S.createBatch}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {summaryQuery.isPending ? (
        <div className={styles.loadingGrid} aria-busy="true">
          <Skeleton label={S.loading} className={styles.skeletonTile} />
          {[1, 2, 3].map((n) => (
            <span key={n} aria-hidden="true" className={styles.skeletonTile} />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={summaryQuery.error instanceof ApiError ? summaryQuery.error.message : S.errorBody}
          requestId={summaryQuery.error instanceof ApiError ? summaryQuery.error.requestId : undefined}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : totalAll === 0 ? (
        <EmptyState
          title={S.emptyTitle}
          description={mayCreate ? S.emptyCanCreate : S.emptyCannotCreate}
          action={
            mayCreate ? (
              <ButtonLink to="/batches/new" variant="primary" leftIcon={<Plus size={15} aria-hidden="true" />}>
                {S.createBatch}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.page} data-testid="dashboard-summary-ready">
          <section aria-labelledby="needs-action-heading">
            <h2 id="needs-action-heading" className={styles.sectionHeading}>
              {S.needsActionHeading}
            </h2>
            <div className={styles.actionGrid}>
              <StatCard
                label={S.tiles.expired.label}
                icon={<CircleX size={16} aria-hidden="true" />}
                value={summary?.expired}
                context={S.tiles.expired.context}
                tone="danger"
                to="/batches?status=EXPIRED"
                testId="action-expired"
              />
              <StatCard
                label={S.tiles.urgent.label}
                icon={<AlarmClock size={16} aria-hidden="true" />}
                value={summary?.urgent}
                context={S.tiles.urgent.context}
                tone="urgent"
                to="/batches?status=URGENT"
                testId="action-urgent"
              />
              <StatCard
                label={S.tiles.hold.label}
                icon={<Lock size={16} aria-hidden="true" />}
                value={summary?.inspectionVerdicts?.FAILED}
                context={S.tiles.hold.context}
                tone="hold"
                to={canViewInspections(user) ? '/inspections?verdict=FAILED' : undefined}
                testId="action-hold"
              />
              <StatCard
                label={S.tiles.dispatchedToday.label}
                icon={<Truck size={16} aria-hidden="true" />}
                value={summary?.dispatchedToday}
                context={S.tiles.dispatchedToday.context(summary?.dispatched ?? 0)}
                to="/batches?status=DISPATCHED"
                testId="action-dispatched-today"
              />
              {summary?.pendingAccessRequests !== null && summary?.pendingAccessRequests !== undefined ? (
                <StatCard
                  label={S.tiles.requests.label}
                  icon={<UserPlus size={16} aria-hidden="true" />}
                  value={summary.pendingAccessRequests}
                  context={S.tiles.requests.context}
                  tone="info"
                  to="/team?tab=requests"
                  testId="dashboard-pending-requests"
                  valueTestId="pending-requests-count"
                />
              ) : null}
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.panel} aria-labelledby="next-heading" data-testid="dashboard-top-expiring">
              <div className={styles.panelHead}>
                <div>
                  <h2 id="next-heading" className={styles.panelTitle}>
                    {S.nextHeading}
                  </h2>
                  <p className={styles.panelSubtitle}>{S.nextSubtitle}</p>
                </div>
                {mayViewQueue ? (
                  <Link to="/fefo" className={styles.textLink}>
                    {S.openQueueShort}
                  </Link>
                ) : null}
              </div>
              {!summary?.topExpiring || summary.topExpiring.length === 0 ? (
                <p className={styles.panelEmpty}>{S.nextEmpty}</p>
              ) : (
                <ol className={styles.nextList} data-testid="top-expiring-list">
                  {summary.topExpiring.map((item) => (
                    <li key={item.id ?? item.batchCode} className={styles.nextItem} data-testid={`top-expiring-item-${item.batchCode}`}>
                      <span className={styles.rank} aria-label={`Rank ${item.rank}`}>
                        {item.rank}
                      </span>
                      <div className={styles.nextMain}>
                        <div className={styles.nextTop}>
                          <Link to={`/batches/${item.id}`} className={styles.code}>
                            {item.batchCode}
                          </Link>
                          {item.status ? <StatusBadge status={item.status} /> : null}
                          {item.qualityCheck?.status === 'FAILED' ? <StatusBadge status="ON_HOLD" /> : null}
                        </div>
                        <div className={styles.nextProduct}>
                          {item.productName} <span className={styles.muted}>{item.sku}</span>
                        </div>
                      </div>
                      <ShelfLifeRail
                        packDate={item.packDate}
                        expiryDate={item.expiryDate}
                        daysUntilExpiry={item.daysUntilExpiry}
                        status={item.status}
                      />
                      <span className={styles.qty}>{S.quantity(item.quantityProduced, item.unit)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className={styles.sideColumn}>
              <section className={styles.panel} aria-labelledby="stock-heading">
                <div className={styles.panelHead}>
                  <div>
                    <h2 id="stock-heading" className={styles.panelTitle}>
                      {S.stockHeading}
                    </h2>
                    <p className={styles.panelSubtitle}>
                      {S.stockActive(totalActive)}, {S.stockDispatched(summary?.dispatched ?? 0)}
                    </p>
                  </div>
                </div>
                <div className={styles.stockBar} role="img" aria-label={S.stockLabel(totalActive)}>
                  {STOCK_SEGMENTS.map((seg) => {
                    const count = summary?.[seg.field] ?? 0;
                    if (count === 0 || totalActive === 0) return null;
                    const segStyle = { '--seg': `${(count / totalActive) * 100}%` } as CSSProperties;
                    return <span key={seg.tier} className={`${styles.stockSeg} ${seg.tone}`} style={segStyle} />;
                  })}
                </div>
                <ul className={styles.legend}>
                  {[...STOCK_SEGMENTS, { tier: 'DISPATCHED' as StatusBadgeValue, field: 'dispatched' as const, tone: styles.segInfo ?? '' }].map(
                    (seg) => (
                      <li key={seg.tier}>
                        <Link
                          to={`/batches?status=${encodeURIComponent(seg.tier)}`}
                          className={styles.legendItem}
                          data-testid={`dashboard-metric-${seg.tier}`}
                        >
                          <span className={`${styles.legendSwatch} ${seg.tone}`} aria-hidden="true" />
                          <span className={styles.legendLabel}>{STATUS_STRINGS[seg.tier as keyof typeof STATUS_STRINGS]}</span>
                          <span className={styles.legendCount} data-testid={`dashboard-count-${seg.tier}`}>
                            {summary?.[seg.field] ?? 0}
                          </span>
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </section>

              <section className={styles.panel} aria-labelledby="inspections-heading" data-testid="dashboard-verdict-summary">
                <div className={styles.panelHead}>
                  <div>
                    <h2 id="inspections-heading" className={styles.panelTitle}>
                      {S.inspectionsHeading}
                    </h2>
                    <p className={styles.panelSubtitle}>{S.inspectionsSubtitle}</p>
                  </div>
                  {canViewInspections(user) ? (
                    <Link to="/inspections" className={styles.textLink}>
                      <ClipboardCheck size={14} aria-hidden="true" /> {S.openInspections}
                    </Link>
                  ) : null}
                </div>
                <dl className={styles.verdicts}>
                  {VERDICTS.map((v) => (
                    <div key={v} className={styles.verdict}>
                      <dt>{S.verdicts[v]}</dt>
                      <dd data-testid={`verdict-count-${v}`}>{summary?.inspectionVerdicts?.[v] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
