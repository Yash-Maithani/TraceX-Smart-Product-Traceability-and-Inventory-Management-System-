import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { fetchFefoQueue, fetchProducts } from '../../api/endpoints';
import type { BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canDispatchBatch } from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { DispatchDialog } from '../batches/DispatchDialog';

export function FefoPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dispatchTarget, setDispatchTarget] = useState<BatchSummaryDto | null>(null);
  const [lastDispatchWarning, setLastDispatchWarning] = useState<string | null>(null);

  const sku = searchParams.get('sku') ?? '';
  const category = searchParams.get('category') ?? '';

  const updateFilter = (key: 'sku' | 'category', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value.trim()) {
      next.delete(key);
    } else {
      next.set(key, value.trim());
    }
    setSearchParams(next);
  };

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of productsQuery.data ?? []) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort();
  }, [productsQuery.data]);

  const fefoQuery = useQuery({
    queryKey: ['fefo', { sku, category }],
    queryFn: () =>
      fetchFefoQueue({
        sku: sku || undefined,
        category: category || undefined
      })
  });

  // Render strictly in server order — zero client-side sorting or freshness logic
  const queue = fefoQuery.data?.queue ?? [];
  const expired = fefoQuery.data?.expired ?? [];
  const exceptions = fefoQuery.data?.exceptions ?? [];
  const allowDispatch = canDispatchBatch(user);

  const queueColumns: TableColumn<BatchSummaryDto>[] = [
    {
      key: 'rank',
      header: 'FEFO Rank',
      render: (row) => (
        <span className={coreStyles.rankPill} data-testid={`fefo-rank-${row.batchCode}`}>
          #{row.rank}
        </span>
      )
    },
    {
      key: 'batchCode',
      header: 'Batch Code',
      render: (row) => (
        <Link to={`/batches/${row.id}`} className={coreStyles.codeLink}>
          {row.batchCode}
        </Link>
      )
    },
    {
      key: 'productName',
      header: 'Product & SKU',
      render: (row) => (
        <div>
          <div>
            <strong>{row.productName}</strong>
          </div>
          <div className={coreStyles.metaLabel}>{row.sku}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Freshness Tier',
      render: (row) => (row.status ? <StatusBadge status={row.status} /> : <span>—</span>)
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (row) => (
        <div>
          <div>{formatBusinessDate(row.expiryDate)}</div>
          <div className={coreStyles.metaLabel}>
            {row.daysUntilExpiry ?? '—'} days remaining
          </div>
        </div>
      )
    },
    {
      key: 'quality',
      header: 'Quality Verdict',
      render: (row) =>
        row.qualityCheck?.status ? (
          <StatusBadge status={row.qualityCheck.status as StatusBadgeValue} />
        ) : (
          <span className={coreStyles.metaLabel}>Uninspected</span>
        )
    },
    {
      key: 'actions',
      header: 'Dispatch',
      render: (row) =>
        allowDispatch ? (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Truck size={14} />}
            onClick={() => setDispatchTarget(row)}
            data-testid={`fefo-dispatch-btn-${row.batchCode}`}
          >
            Dispatch
          </Button>
        ) : (
          <span className={coreStyles.metaLabel}>View only</span>
        )
    }
  ];

  return (
    <div className={coreStyles.pageStack} data-testid="fefo-page">
      <PageHeader
        title="FEFO Dispatch Queue"
        subtitle="First-Expired, First-Out dispatch ordering computed by the server. Expired and exception batches are isolated below."
        backdropKey="fefo"
        priority
      />

      {lastDispatchWarning ? (
        <div
          className={`${coreStyles.alertBanner} ${coreStyles.alertWarning}`}
          role="status"
          data-testid="fefo-flagged-warning-banner"
        >
          <strong>Dispatch Advisory:</strong> {lastDispatchWarning}
        </div>
      ) : null}

      <section className={coreStyles.filterBar} aria-label="FEFO filters">
        <Field label="Filter by Category">
          <Select
            value={category}
            onChange={(e) => updateFilter('category', e.target.value)}
            data-testid="fefo-filter-category"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Filter by SKU">
          <Select
            value={sku}
            onChange={(e) => updateFilter('sku', e.target.value)}
            data-testid="fefo-filter-sku"
          >
            <option value="">All SKUs</option>
            {(productsQuery.data ?? []).map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.productName}
              </option>
            ))}
          </Select>
        </Field>

        <div className={coreStyles.filterActions}>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={() => setSearchParams(new URLSearchParams())}
            data-testid="fefo-reset-filters-btn"
          >
            Reset Filters
          </Button>
        </div>
      </section>

      {fefoQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading FEFO dispatch queue" />
        </div>
      ) : fefoQuery.isError ? (
        <ErrorState
          title="Unable to load FEFO dispatch queue"
          description={
            fefoQuery.error instanceof Error
              ? fefoQuery.error.message
              : 'Failed to load FEFO queue.'
          }
          requestId={
            fefoQuery.error instanceof ApiError ? fefoQuery.error.requestId : undefined
          }
          onRetry={() => void fefoQuery.refetch()}
        />
      ) : (
        <>
          <section className={coreStyles.sectionCard} data-testid="fefo-queue-section">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>
                  1. Eligible FEFO Dispatch Queue ({queue.length})
                </h2>
                <p className={coreStyles.sectionSubtitle}>
                  Ranked by server freshness tier (URGENT → WARNING → READY) and earliest expiry
                  date. Out-of-order dispatches within a SKU require an audited override reason.
                </p>
              </div>
            </div>

            {queue.length === 0 ? (
              <EmptyState
                title="No eligible batches in FEFO queue"
                description="No active URGENT, WARNING, or READY batches match the selected filters."
              />
            ) : (
              <>
                <div className={coreStyles.desktopTableWrap}>
                  <Table
                    caption="Eligible FEFO dispatch queue"
                    columns={queueColumns}
                    data={queue}
                    rowKey={(row) => row.id ?? row.batchCode ?? ''}
                  />
                </div>

                <div className={coreStyles.mobileCardList}>
                  {queue.map((row) => (
                    <article
                      key={row.id ?? row.batchCode}
                      className={coreStyles.itemCard}
                      data-testid={`fefo-mobile-card-${row.batchCode}`}
                    >
                      <div className={coreStyles.itemCardHeader}>
                        <div className={coreStyles.inlineRow}>
                          <span className={coreStyles.rankPill}>#{row.rank}</span>
                          <Link to={`/batches/${row.id}`} className={coreStyles.codeLink}>
                            {row.batchCode}
                          </Link>
                        </div>
                        {row.status ? <StatusBadge status={row.status} /> : null}
                      </div>
                      <div>
                        <strong>{row.productName}</strong> ({row.sku})
                      </div>
                      <div className={coreStyles.itemCardMetaGrid}>
                        <div className={coreStyles.metaItem}>
                          <span className={coreStyles.metaLabel}>Expiry Date</span>
                          <span className={coreStyles.metaValue}>
                            {formatBusinessDate(row.expiryDate)} ({row.daysUntilExpiry ?? '—'}d)
                          </span>
                        </div>
                        <div className={coreStyles.metaItem}>
                          <span className={coreStyles.metaLabel}>Quality</span>
                          <span className={coreStyles.metaValue}>
                            {row.qualityCheck?.status ?? 'Uninspected'}
                          </span>
                        </div>
                      </div>
                      {allowDispatch ? (
                        <div>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Truck size={14} />}
                            onClick={() => setDispatchTarget(row)}
                          >
                            Dispatch
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className={coreStyles.sectionCard} data-testid="fefo-expired-section">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>
                  2. Expired Batches — Blocked from Dispatch ({expired.length})
                </h2>
                <p className={coreStyles.sectionSubtitle}>
                  Excluded from the dispatchable FEFO queue per D-12. Attempting to dispatch returns
                  HTTP 409 BATCH_EXPIRED.
                </p>
              </div>
            </div>

            {expired.length === 0 ? (
              <p className={coreStyles.sectionSubtitle}>No expired batches.</p>
            ) : (
              <ul className={coreStyles.timelineList} data-testid="fefo-expired-list">
                {expired.map((item) => (
                  <li
                    key={item.id ?? item.batchCode}
                    className={coreStyles.timelineItem}
                    data-testid={`fefo-expired-item-${item.batchCode}`}
                  >
                    <div className={coreStyles.itemCardHeader}>
                      <div className={coreStyles.inlineRow}>
                        <Link to={`/batches/${item.id}`} className={coreStyles.codeLink}>
                          {item.batchCode}
                        </Link>
                        <span>
                          <strong>{item.productName}</strong> ({item.sku})
                        </span>
                      </div>
                      <StatusBadge status="EXPIRED" />
                    </div>
                    <div className={coreStyles.timelineHeader}>
                      <span>Expiry: {formatBusinessDate(item.expiryDate)}</span>
                      <span>Days: {item.daysUntilExpiry ?? '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={coreStyles.sectionCard} data-testid="fefo-exceptions-section">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>
                  3. Data Exceptions — Missing or Corrupted Expiry ({exceptions.length})
                </h2>
                <p className={coreStyles.sectionSubtitle}>
                  Batches with missing, null, or unparseable expiry dates are isolated here until
                  corrected via Raw-Material Correction.
                </p>
              </div>
            </div>

            {exceptions.length === 0 ? (
              <p className={coreStyles.sectionSubtitle}>No data exception batches.</p>
            ) : (
              <ul className={coreStyles.timelineList} data-testid="fefo-exceptions-list">
                {exceptions.map((item) => (
                  <li
                    key={item.id ?? item.batchCode}
                    className={coreStyles.timelineItem}
                    data-testid={`fefo-exception-item-${item.batchCode}`}
                  >
                    <div className={coreStyles.itemCardHeader}>
                      <div className={coreStyles.inlineRow}>
                        <Link to={`/batches/${item.id}`} className={coreStyles.codeLink}>
                          {item.batchCode}
                        </Link>
                        <span>
                          <strong>{item.productName}</strong> ({item.sku})
                        </span>
                      </div>
                      <StatusBadge status="EXCEPTION" />
                    </div>
                    <div className={coreStyles.metaValue}>
                      <strong>Exception Reason:</strong>{' '}
                      {item.exceptionReason ?? 'Invalid expiryDate'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <DispatchDialog
        open={Boolean(dispatchTarget)}
        onClose={() => setDispatchTarget(null)}
        batch={dispatchTarget}
        onSuccess={(_updated, warning) => {
          setLastDispatchWarning(warning ?? null);
        }}
      />
    </div>
  );
}
