import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, ClipboardCheck, ShieldAlert, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { fetchDashboardSummary } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { canViewFefoQueue, canViewInspections } from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  type StatusBadgeValue
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { STRINGS } from '../../strings/en';

const STATUS_CARDS: readonly {
  tier: StatusBadgeValue;
  label: string;
  hint: string;
  field: 'expired' | 'urgent' | 'warning' | 'ready' | 'exception' | 'dispatched';
}[] = [
  {
    tier: 'EXPIRED',
    label: 'Expired',
    hint: 'Blocked from dispatch',
    field: 'expired'
  },
  {
    tier: 'URGENT',
    label: 'Urgent',
    hint: 'Priority FEFO tier',
    field: 'urgent'
  },
  {
    tier: 'WARNING',
    label: 'Warning',
    hint: 'Approaching expiry window',
    field: 'warning'
  },
  {
    tier: 'READY',
    label: 'Ready',
    hint: 'Standard shelf life',
    field: 'ready'
  },
  {
    tier: 'EXCEPTION',
    label: 'Exception',
    hint: 'Missing or invalid expiry date',
    field: 'exception'
  },
  {
    tier: 'DISPATCHED',
    label: 'Dispatched',
    hint: 'Completed shipments',
    field: 'dispatched'
  }
];

export function DashboardPage() {
  const { user, refreshSession } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary
  });

  const summary = summaryQuery.data;
  const totalAll = (summary?.totalActive ?? 0) + (summary?.dispatched ?? 0);
  const roleLabel = user?.role ? (STRINGS.roles[user.role] ?? user.role) : 'Unassigned';

  return (
    <div className={coreStyles.pageStack} data-testid="dashboard-page">
      <PageHeader
        title="Operations Dashboard"
        subtitle={
          summary?.businessDate
            ? `Server-computed freshness tiers and FEFO queue as of business date ${formatBusinessDate(summary.businessDate)}`
            : 'Server-computed freshness tiers, inspection verdicts, and FEFO queue overview'
        }
        backdropKey="dashboard"
        priority
        actions={
          <div className={coreStyles.inlineRow}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void refreshSession();
                void summaryQuery.refetch();
              }}
              data-testid="verify-session-btn"
            >
              Refresh
            </Button>
            <Link to="/batches">
              <Button variant="secondary" size="sm" leftIcon={<Boxes size={15} />}>
                All Batches
              </Button>
            </Link>
            {canViewFefoQueue(user) ? (
              <Link to="/fefo">
                <Button variant="primary" size="sm" leftIcon={<Truck size={15} />}>
                  FEFO Queue
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {user ? (
        <section className={coreStyles.sectionCard} aria-label="Signed-in operator">
          <div className={coreStyles.inlineRow}>
            <span className={coreStyles.mutedText}>Operator:</span>
            <strong data-testid="home-user-name">{user.name}</strong>
            <span className={coreStyles.monoText} data-testid="home-user-username">
              {user.username}
            </span>
            <span className={coreStyles.mutedText}>•</span>
            <span data-testid="home-user-role">{roleLabel}</span>
          </div>
        </section>
      ) : null}

      {summaryQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading dashboard summary" />
        </div>
      ) : summaryQuery.isError ? (
        <ErrorState
          title="Unable to load dashboard summary"
          description={
            summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : 'An error occurred while loading the dashboard summary.'
          }
          requestId={
            summaryQuery.error instanceof ApiError ? summaryQuery.error.requestId : undefined
          }
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : totalAll === 0 ? (
        <EmptyState
          title="No batches recorded yet"
          description="Create your first production batch to populate freshness tiers and the FEFO queue."
          action={
            <Link to="/batches">
              <Button variant="primary">Go to Batches</Button>
            </Link>
          }
        />
      ) : (
        <div className={coreStyles.pageStack} data-testid="dashboard-summary-ready">
          <section aria-label="Freshness tier metrics">
            <div className={coreStyles.metricsGrid}>
              {STATUS_CARDS.map((card) => {
                const count = summary?.[card.field] ?? 0;
                return (
                  <Link
                    key={card.tier}
                    to={`/batches?status=${encodeURIComponent(card.tier)}`}
                    className={coreStyles.metricCard}
                    data-testid={`dashboard-metric-${card.tier}`}
                  >
                    <div className={coreStyles.metricLabelRow}>
                      <span>{card.label}</span>
                      <StatusBadge status={card.tier} />
                    </div>
                    <div className={coreStyles.metricValue} data-testid={`dashboard-count-${card.tier}`}>
                      {count}
                    </div>
                    <div className={coreStyles.metricHint}>{card.hint}</div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className={coreStyles.twoColumnGrid}>
            <section className={coreStyles.sectionCard} data-testid="dashboard-verdict-summary">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Latest Inspection Verdicts</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Quality status across all non-archived batches ({summary?.totalActive ?? 0} active,{' '}
                    {summary?.dispatched ?? 0} dispatched)
                  </p>
                </div>
                {canViewInspections(user) ? (
                  <Link to="/inspections">
                    <Button variant="secondary" size="sm" leftIcon={<ClipboardCheck size={15} />}>
                      Inspections
                    </Button>
                  </Link>
                ) : null}
              </div>

              <div className={coreStyles.metricsGrid}>
                <div className={coreStyles.itemCard}>
                  <div className={coreStyles.metricLabelRow}>
                    <span>Passed</span>
                    <StatusBadge status="PASSED" />
                  </div>
                  <div className={coreStyles.metricValue} data-testid="verdict-count-PASSED">
                    {summary?.inspectionVerdicts?.PASSED ?? 0}
                  </div>
                </div>

                <div className={coreStyles.itemCard}>
                  <div className={coreStyles.metricLabelRow}>
                    <span>Flagged</span>
                    <StatusBadge status="FLAGGED" />
                  </div>
                  <div className={coreStyles.metricValue} data-testid="verdict-count-FLAGGED">
                    {summary?.inspectionVerdicts?.FLAGGED ?? 0}
                  </div>
                </div>

                <div className={coreStyles.itemCard}>
                  <div className={coreStyles.metricLabelRow}>
                    <span>Failed (Hold)</span>
                    <StatusBadge status="FAILED" />
                  </div>
                  <div className={coreStyles.metricValue} data-testid="verdict-count-FAILED">
                    {summary?.inspectionVerdicts?.FAILED ?? 0}
                  </div>
                </div>

                <div className={coreStyles.itemCard}>
                  <div className={coreStyles.metricLabelRow}>
                    <span>Uninspected</span>
                  </div>
                  <div className={coreStyles.metricValue} data-testid="verdict-count-none">
                    {summary?.inspectionVerdicts?.none ?? 0}
                  </div>
                </div>
              </div>
            </section>

            {summary?.pendingAccessRequests !== null &&
            summary?.pendingAccessRequests !== undefined ? (
              <section
                className={coreStyles.sectionCard}
                data-testid="dashboard-pending-requests"
              >
                <div className={coreStyles.sectionHeader}>
                  <div>
                    <h2 className={coreStyles.sectionTitle}>Pending Access Requests</h2>
                    <p className={coreStyles.sectionSubtitle}>
                      Role-scoped onboarding requests awaiting administrator review
                    </p>
                  </div>
                  <ShieldAlert size={20} aria-hidden="true" />
                </div>
                <div className={coreStyles.metricValue} data-testid="pending-requests-count">
                  {summary.pendingAccessRequests}
                </div>
                <p className={coreStyles.sectionSubtitle}>
                  Visible only to Manager, Admin, and Super Admin accounts.
                </p>
              </section>
            ) : null}
          </div>

          <section className={coreStyles.sectionCard} data-testid="dashboard-top-expiring">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>Top 5 Expiring-Soon Batches (FEFO)</h2>
                <p className={coreStyles.sectionSubtitle}>
                  Ordered by the server FEFO engine (freshness tier, then earliest expiry date)
                </p>
              </div>
              <Link to="/fefo">
                <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={15} />}>
                  View Full FEFO Queue
                </Button>
              </Link>
            </div>

            {!summary?.topExpiring || summary.topExpiring.length === 0 ? (
              <EmptyState
                title="No eligible batches in FEFO queue"
                description="All active batches are either dispatched or expired."
              />
            ) : (
              <ul className={coreStyles.timelineList} data-testid="top-expiring-list">
                {summary.topExpiring.map((item) => (
                  <li
                    key={item.id ?? item.batchCode}
                    className={coreStyles.timelineItem}
                    data-testid={`top-expiring-item-${item.batchCode}`}
                  >
                    <div className={coreStyles.itemCardHeader}>
                      <div className={coreStyles.inlineRow}>
                        <span className={coreStyles.rankPill}>#{item.rank}</span>
                        <Link
                          to={`/batches/${item.id}`}
                          className={coreStyles.codeLink}
                        >
                          {item.batchCode}
                        </Link>
                        <span>
                          <strong>{item.productName}</strong> ({item.sku})
                        </span>
                      </div>
                      <div className={coreStyles.inlineRow}>
                        {item.status ? <StatusBadge status={item.status} /> : null}
                        {item.qualityCheck?.status ? (
                          <StatusBadge
                            status={item.qualityCheck.status as StatusBadgeValue}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className={coreStyles.timelineHeader}>
                      <span>
                        Expiry: <strong>{formatBusinessDate(item.expiryDate)}</strong> (
                        {item.daysUntilExpiry ?? '—'} days remaining)
                      </span>
                      <span>
                        Qty: {item.quantityProduced} {item.unit}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
