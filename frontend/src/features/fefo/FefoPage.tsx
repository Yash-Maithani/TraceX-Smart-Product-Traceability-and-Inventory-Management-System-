import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import batchStyles from '../batches/batches.module.css';
import styles from './fefo.module.css';
import { ApiError } from '../../api/client';
import { fetchFefoQueue, fetchProducts } from '../../api/endpoints';
import type { BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canDispatchBatch } from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterChip,
  PageHeader,
  ShelfLifeRail,
  Skeleton,
  StatusBadge,
  Table,
  Tabs,
  isOnHold,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { FEFO_STRINGS as S } from '../../strings/fefo';
import { RAIL_STRINGS } from '../../strings/status';
import { DispatchDialog } from '../batches/DispatchDialog';
import { DispatchBriefPanel } from './DispatchBriefPanel';
import { nextToShipIds } from './queueModel';

type FefoTab = 'queue' | 'expired' | 'missing';
const TAB_IDS: readonly FefoTab[] = ['queue', 'expired', 'missing'];

/** "Expired N days ago" from the server's day count; nothing when the count is missing. */
function expiredAgoText(days: number | null | undefined): string | null {
  return days === null || days === undefined ? null : RAIL_STRINGS.expiredAgo(Math.abs(days));
}

function QualityCell({ row }: { row: BatchSummaryDto }) {
  const verdict = row.qualityCheck?.status;
  if (isOnHold(row)) return <StatusBadge status="ON_HOLD" />;
  if (verdict) return <StatusBadge status={verdict as StatusBadgeValue} />;
  return <span className={batchStyles.muted}>{S.notInspected}</span>;
}

export function FefoPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dispatchTarget, setDispatchTarget] = useState<BatchSummaryDto | null>(null);
  const [lastDispatchWarning, setLastDispatchWarning] = useState<string | null>(null);

  const sku = searchParams.get('sku') ?? '';
  const category = searchParams.get('category') ?? '';
  const tabParam = searchParams.get('tab') as FefoTab | null;
  const tab: FefoTab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'queue';

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value.trim()) next.set(key, value.trim());
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of productsQuery.data ?? []) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [productsQuery.data]);

  const productOptions = useMemo(
    () =>
      (productsQuery.data ?? [])
        .filter((p) => p.sku)
        .map((p) => ({ value: p.sku as string, label: `${p.productName ?? p.sku} (${p.sku})` })),
    [productsQuery.data]
  );

  const fefoQuery = useQuery({
    queryKey: ['fefo', { sku, category }],
    queryFn: () => fetchFefoQueue({ sku: sku || undefined, category: category || undefined })
  });

  // Rows stay in server order; the page only groups them to mark the next batch per product
  const queue = fefoQuery.data?.queue ?? [];
  const expired = fefoQuery.data?.expired ?? [];
  const exceptions = fefoQuery.data?.exceptions ?? [];
  const nextIds = useMemo(() => nextToShipIds(fefoQuery.data?.queue ?? []), [fefoQuery.data]);
  const allowDispatch = canDispatchBatch(user);
  const anyFilter = Boolean(sku || category);

  const dispatchCell = (row: BatchSummaryDto, compact = false) => {
    if (!allowDispatch) return <span className={batchStyles.muted}>{S.viewOnly}</span>;
    const held = isOnHold(row);
    const isNext = Boolean(row.id && nextIds.has(row.id));
    const reasonId = `fefo-hold-${row.id ?? row.batchCode}${compact ? '-m' : ''}`;
    return (
      <span className={styles.actionCell}>
        <Button
          variant={isNext ? 'primary' : 'secondary'}
          size="sm"
          leftIcon={held ? <Lock size={14} /> : <Truck size={14} />}
          onClick={() => setDispatchTarget(row)}
          disabled={held}
          aria-label={S.dispatchBatch(row.batchCode ?? '')}
          aria-describedby={held ? reasonId : undefined}
          title={held ? S.onHoldReason : undefined}
          data-testid={compact ? undefined : `fefo-dispatch-btn-${row.batchCode}`}
        >
          {S.dispatch}
        </Button>
        {held ? (
          <span id={reasonId} className={styles.holdNote} data-testid={compact ? undefined : `fefo-hold-note-${row.batchCode}`}>
            {S.onHoldReason}
          </span>
        ) : null}
      </span>
    );
  };

  const queueColumns: TableColumn<BatchSummaryDto>[] = [
    {
      key: 'rank',
      header: S.columns.order,
      nowrap: true,
      numeric: true,
      render: (row) => (
        <span className={styles.rank} data-testid={`fefo-rank-${row.batchCode}`} aria-label={S.orderLabel(row.rank ?? 0)}>
          #{row.rank}
        </span>
      )
    },
    {
      key: 'batch',
      header: S.columns.batch,
      render: (row) => (
        <div className={batchStyles.product}>
          <span className={styles.codeRow}>
            <Link to={`/batches/${row.id}`} className={batchStyles.code}>
              {row.batchCode}
            </Link>
            {row.id && nextIds.has(row.id) ? (
              <span className={styles.nextTag} data-testid={`fefo-next-${row.batchCode}`}>
                {S.nextForProduct}
              </span>
            ) : null}
          </span>
          <span>{row.productName}</span>
          <span className={batchStyles.muted}>{row.sku}</span>
        </div>
      )
    },
    {
      key: 'stock',
      header: S.columns.stock,
      nowrap: true,
      numeric: true,
      render: (row) => (
        <span data-testid={`fefo-stock-${row.batchCode}`}>
          {S.stock(row.quantityRemaining ?? row.quantityProduced ?? 0, row.quantityProduced ?? 0, row.unit)}
        </span>
      )
    },
    {
      key: 'shelf',
      header: S.columns.shelfLife,
      render: (row) => (
        <ShelfLifeRail packDate={row.packDate} expiryDate={row.expiryDate} daysUntilExpiry={row.daysUntilExpiry} status={row.status} />
      )
    },
    {
      key: 'expires',
      header: S.columns.expires,
      nowrap: true,
      render: (row) => (
        <span className={styles.expiryCell}>
          <span>{formatBusinessDate(row.expiryDate)}</span>
          {row.status ? <StatusBadge status={row.status} /> : null}
        </span>
      )
    },
    {
      key: 'quality',
      header: S.columns.quality,
      nowrap: true,
      render: (row) => <QualityCell row={row} />
    },
    {
      key: 'actions',
      header: S.columns.action,
      render: (row) => dispatchCell(row)
    }
  ];

  const tabs = [
    { id: 'queue', label: S.tabs.queue, count: queue.length, testId: 'fefo-tab-queue' },
    { id: 'expired', label: S.tabs.expired, count: expired.length, testId: 'fefo-tab-expired' },
    { id: 'missing', label: S.tabs.missing, count: exceptions.length, testId: 'fefo-tab-missing' }
  ];

  return (
    <div className={batchStyles.page} data-testid="fefo-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={
          fefoQuery.data ? (
            <span data-testid="fefo-summary">{S.summary(queue.length, expired.length, exceptions.length)}</span>
          ) : undefined
        }
        backdropKey="fefo"
        priority
      />

      <DispatchBriefPanel />

      {lastDispatchWarning ? (
        <div className={styles.warning} role="status" data-testid="fefo-flagged-warning-banner">
          <strong>{S.warningTitle}.</strong> {lastDispatchWarning}
        </div>
      ) : null}

      <section className={batchStyles.toolbar} aria-label={S.filtersLabel}>
        <FilterChip
          label={S.categoryFilter}
          value={category}
          options={categoryOptions}
          onChange={(v) => updateParams({ category: v })}
          testId="fefo-filter-category"
        />
        <FilterChip
          label={S.productFilter}
          value={sku}
          options={productOptions}
          onChange={(v) => updateParams({ sku: v })}
          testId="fefo-filter-sku"
        />
        {anyFilter ? (
          <button
            type="button"
            className={batchStyles.clearLink}
            onClick={() => updateParams({ sku: '', category: '' })}
            data-testid="fefo-reset-filters-btn"
          >
            {S.clearFilters}
          </button>
        ) : null}
      </section>

      <Tabs label={S.tabsLabel} tabs={tabs} selectedId={tab} onSelect={(id) => updateParams({ tab: id === 'queue' ? '' : id })} idPrefix="fefo" />

      {fefoQuery.isPending ? (
        <div className={styles.panel} aria-busy="true">
          <Skeleton label={S.loading} />
        </div>
      ) : fefoQuery.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={fefoQuery.error instanceof ApiError ? fefoQuery.error.message : S.errorBody}
          requestId={fefoQuery.error instanceof ApiError ? fefoQuery.error.requestId : undefined}
          onRetry={() => void fefoQuery.refetch()}
        />
      ) : tab === 'queue' ? (
        <section
          id="fefo-panel-queue"
          role="tabpanel"
          aria-labelledby="fefo-tab-queue"
          className={styles.panelPlain}
          data-testid="fefo-queue-section"
        >
          {queue.length === 0 ? (
            anyFilter ? (
              <EmptyState
                title={S.emptyNoMatchTitle}
                description={S.emptyNoMatchBody}
                action={
                  <Button variant="secondary" onClick={() => updateParams({ sku: '', category: '' })}>
                    {S.clearFilters}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={S.emptyQueueTitle} description={S.emptyQueueBody} />
            )
          ) : (
            <>
              <div className={batchStyles.desktopOnly}>
                <Table caption={S.caption} columns={queueColumns} data={queue} rowKey={(row) => row.id ?? row.batchCode ?? ''} />
              </div>
              <ul className={batchStyles.mobileList}>
                {queue.map((row) => (
                  <li key={row.id ?? row.batchCode} className={batchStyles.card} data-testid={`fefo-mobile-card-${row.batchCode}`}>
                    <div className={batchStyles.cardTop}>
                      <span className={styles.codeRow}>
                        <span className={styles.rank}>#{row.rank}</span>
                        <Link to={`/batches/${row.id}`} className={batchStyles.code}>
                          {row.batchCode}
                        </Link>
                      </span>
                      <span className={batchStyles.badges}>
                        {row.status ? <StatusBadge status={row.status} /> : null}
                        <QualityCell row={row} />
                      </span>
                    </div>
                    <div className={batchStyles.cardProduct}>
                      {row.productName} <span className={batchStyles.muted}>{row.sku}</span>
                      {row.id && nextIds.has(row.id) ? <span className={styles.nextTag}>{S.nextForProduct}</span> : null}
                    </div>
                    <ShelfLifeRail packDate={row.packDate} expiryDate={row.expiryDate} daysUntilExpiry={row.daysUntilExpiry} status={row.status} />
                    {dispatchCell(row, true)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : tab === 'expired' ? (
        <section
          id="fefo-panel-expired"
          role="tabpanel"
          aria-labelledby="fefo-tab-expired"
          className={styles.panel}
          data-testid="fefo-expired-section"
        >
          <p className={styles.intro}>{S.expiredIntro}</p>
          {expired.length === 0 ? (
            <p className={batchStyles.muted}>{S.expiredEmpty}</p>
          ) : (
            <ul className={styles.list} data-testid="fefo-expired-list">
              {expired.map((item) => (
                <li key={item.id ?? item.batchCode} className={styles.listRow} data-testid={`fefo-expired-item-${item.batchCode}`}>
                  <span className={batchStyles.product}>
                    <Link to={`/batches/${item.id}`} className={batchStyles.code}>
                      {item.batchCode}
                    </Link>
                    <span>
                      {item.productName} <span className={batchStyles.muted}>{item.sku}</span>
                    </span>
                  </span>
                  <span className={styles.listMeta}>
                    <span>{formatBusinessDate(item.expiryDate)}</span>
                    <span className={batchStyles.muted}>
                      {expiredAgoText(item.daysUntilExpiry)}
                    </span>
                  </span>
                  <StatusBadge status="EXPIRED" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section
          id="fefo-panel-missing"
          role="tabpanel"
          aria-labelledby="fefo-tab-missing"
          className={styles.panel}
          data-testid="fefo-exceptions-section"
        >
          <p className={styles.intro}>{S.missingIntro}</p>
          {exceptions.length === 0 ? (
            <p className={batchStyles.muted}>{S.missingEmpty}</p>
          ) : (
            <ul className={styles.list} data-testid="fefo-exceptions-list">
              {exceptions.map((item) => (
                <li key={item.id ?? item.batchCode} className={styles.listRow} data-testid={`fefo-exception-item-${item.batchCode}`}>
                  <span className={batchStyles.product}>
                    <Link to={`/batches/${item.id}`} className={batchStyles.code}>
                      {item.batchCode}
                    </Link>
                    <span>
                      {item.productName} <span className={batchStyles.muted}>{item.sku}</span>
                    </span>
                  </span>
                  <span className={styles.listMeta}>
                    <span className={batchStyles.muted}>{S.missingReason}</span>
                    <span>{item.exceptionReason ?? S.missingReasonFallback}</span>
                  </span>
                  <StatusBadge status="EXCEPTION" />
                </li>
              ))}
            </ul>
          )}
        </section>
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
