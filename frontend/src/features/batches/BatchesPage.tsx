import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styles from './batches.module.css';
import { BatchListTabs } from './BatchListTabs';
import { ApiError } from '../../api/client';
import { fetchBatches, fetchProducts } from '../../api/endpoints';
import type { BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canCreateBatch } from '../../auth/permissions.generated';
import {
  Button,
  DateRangeChip,
  EmptyState,
  ErrorState,
  FilterChip,
  PageHeader,
  Pagination,
  ShelfLifeRail,
  StatusBadge,
  Table,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { BATCH_STRINGS as S } from '../../strings/batches';
import { STATUS_STRINGS } from '../../strings/status';
import { CreateBatchDialog } from './CreateBatchDialog';

const STATUS_OPTIONS = [
  { value: 'READY', label: STATUS_STRINGS.READY },
  { value: 'WARNING', label: STATUS_STRINGS.WARNING },
  { value: 'URGENT', label: STATUS_STRINGS.URGENT },
  { value: 'EXPIRED', label: STATUS_STRINGS.EXPIRED },
  { value: 'EXCEPTION', label: STATUS_STRINGS.EXCEPTION },
  { value: 'DISPATCHED', label: STATUS_STRINGS.DISPATCHED }
] as const;

/** Table column key to the server's sort field (BatchService whitelist). */
const SORT_FIELDS: Record<string, string> = {
  code: 'batchCode',
  product: 'productName',
  expires: 'expiryDate',
  quantity: 'quantityProduced'
};

const SEARCH_DELAY_MS = 250;

function QualityCell({ row }: { row: BatchSummaryDto }) {
  const verdict = row.qualityCheck?.status;
  if (verdict === 'FAILED') return <StatusBadge status="ON_HOLD" />;
  if (verdict) return <StatusBadge status={verdict as StatusBadgeValue} />;
  return <span className={styles.muted}>{S.notInspected}</span>;
}

export function BatchesPage({ openCreateInitially = false }: { openCreateInitially?: boolean }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNewRoute = openCreateInitially || location.pathname === '/batches/new';
  const [createOpen, setCreateOpen] = useState(isNewRoute);
  const mayCreate = canCreateBatch(user);

  const status = searchParams.get('status') ?? '';
  const sku = searchParams.get('sku') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const expiryFrom = searchParams.get('expiryFrom') ?? '';
  const expiryTo = searchParams.get('expiryTo') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20);

  // The search box is local while typing; the URL follows after a short pause (AUDIT: no request
  // and no history entry per keystroke).
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);

  const updateParams = (changes: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value.trim() === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in changes)) next.set('page', '1');
    setSearchParams(next, { replace });
  };

  useEffect(() => {
    if (searchDraft === search) return undefined;
    const t = setTimeout(() => updateParams({ search: searchDraft }, true), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const anyFilter = Boolean(status || sku || search || expiryFrom || expiryTo);
  const clearFilters = () => {
    setSearchDraft('');
    const next = new URLSearchParams();
    if (sort) next.set('sort', sort);
    setSearchParams(next);
  };

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const batchesQuery = useQuery({
    queryKey: ['batches', { page, limit, status, sku, search, sort, expiryFrom, expiryTo }],
    queryFn: () =>
      fetchBatches({
        page,
        limit,
        status: status || undefined,
        sku: sku || undefined,
        search: search || undefined,
        sort: sort || undefined,
        expiryFrom: expiryFrom || undefined,
        expiryTo: expiryTo || undefined
      })
  });

  const batches = batchesQuery.data?.data ?? [];
  const total = batchesQuery.data?.total ?? 0;

  const [sortField, sortDir] = sort ? sort.split(':') : ['', ''];
  const sortKey = Object.keys(SORT_FIELDS).find((k) => SORT_FIELDS[k] === sortField);
  const onSortChange = (key: string) => {
    const field = SORT_FIELDS[key];
    if (!field) return;
    const nextDir = sortField === field && sortDir !== 'desc' ? 'desc' : 'asc';
    updateParams({ sort: `${field}:${nextDir}` });
  };

  const columns: TableColumn<BatchSummaryDto>[] = [
    {
      key: 'code',
      header: S.columns.code,
      sortable: true,
      nowrap: true,
      render: (row) => (
        <Link to={`/batches/${row.id}`} className={styles.code} data-testid={`batch-link-${row.batchCode}`}>
          {row.batchCode}
        </Link>
      )
    },
    {
      key: 'product',
      header: S.columns.product,
      sortable: true,
      render: (row) => (
        <div className={styles.product}>
          <span>{row.productName}</span>
          <span className={styles.muted}>{row.sku}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: S.columns.status,
      nowrap: true,
      render: (row) => (row.status ? <StatusBadge status={row.status} /> : <span className={styles.muted}>-</span>)
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
      sortable: true,
      nowrap: true,
      render: (row) => <span data-testid={`batch-expiry-${row.batchCode}`}>{formatBusinessDate(row.expiryDate)}</span>
    },
    {
      key: 'quality',
      header: S.columns.quality,
      nowrap: true,
      render: (row) => <QualityCell row={row} />
    },
    {
      key: 'quantity',
      header: S.columns.quantity,
      sortable: true,
      numeric: true,
      render: (row) => S.quantity(row.quantityProduced, row.unit)
    },
    {
      key: 'origin',
      header: S.columns.origin,
      render: (row) => (
        <div className={styles.product}>
          <span className={styles.mono}>{row.sourceLotCode}</span>
          <span className={styles.muted}>{row.village}</span>
        </div>
      )
    }
  ];

  const handleCloseCreate = () => {
    setCreateOpen(false);
    if (location.pathname === '/batches/new') {
      navigate('/batches', { replace: true });
    }
  };

  const productOptions = (productsQuery.data ?? []).map((p) => ({ value: p.sku ?? '', label: `${p.productName} (${p.sku})` }));

  return (
    <div className={styles.page} data-testid="batches-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={
          batchesQuery.isSuccess ? (
            <span className={styles.countChip} data-testid="batches-count">
              {S.count(total)}
            </span>
          ) : undefined
        }
        backdropKey="batches"
        priority
        actions={
          mayCreate ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setCreateOpen(true)}
              data-testid="open-create-batch-btn"
            >
              {S.createBatch}
            </Button>
          ) : null
        }
      />

      <BatchListTabs />

      <section className={styles.toolbar} aria-label={S.searchLabel}>
        <label className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{S.searchLabel}</span>
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={S.searchPlaceholder}
            data-testid="batches-filter-search"
          />
        </label>
        <FilterChip
          label={S.statusFilter}
          value={status}
          options={STATUS_OPTIONS}
          onChange={(v) => updateParams({ status: v })}
          testId="batches-filter-status"
        />
        <FilterChip
          label={S.skuFilter}
          value={sku}
          options={productOptions}
          onChange={(v) => updateParams({ sku: v })}
          testId="batches-filter-sku"
        />
        <DateRangeChip
          label={S.expiryFilter}
          fromLabel={S.expiryFrom}
          toLabel={S.expiryTo}
          from={expiryFrom}
          to={expiryTo}
          onApply={(from, to) => updateParams({ expiryFrom: from, expiryTo: to })}
          testId="batches-filter-expiry"
        />
        {anyFilter ? (
          <button type="button" className={styles.clearLink} onClick={clearFilters} data-testid="batches-reset-filters-btn">
            {S.clearFilters}
          </button>
        ) : null}
      </section>

      {batchesQuery.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={batchesQuery.error instanceof ApiError ? batchesQuery.error.message : S.errorBody}
          requestId={batchesQuery.error instanceof ApiError ? batchesQuery.error.requestId : undefined}
          onRetry={() => void batchesQuery.refetch()}
        />
      ) : !batchesQuery.isPending && batches.length === 0 ? (
        anyFilter ? (
          <EmptyState
            title={S.emptyNoMatchTitle}
            description={S.emptyNoMatchBody}
            action={
              <Button variant="secondary" onClick={clearFilters}>
                {S.clearFilters}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={S.emptyFirstTitle}
            description={mayCreate ? S.emptyFirstCanCreate : S.emptyFirstCannotCreate}
            action={
              mayCreate ? (
                <Button variant="primary" leftIcon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
                  {S.createBatch}
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className={styles.desktopOnly} data-testid="batches-desktop-table">
            <Table
              caption={S.caption}
              columns={columns}
              data={batches}
              rowKey={(row) => row.id ?? row.batchCode ?? ''}
              isLoading={batchesQuery.isPending}
              sortKey={sortKey}
              sortDirection={sortDir === 'desc' ? 'desc' : 'asc'}
              onSortChange={onSortChange}
            />
          </div>
          <ul className={styles.mobileList} data-testid="batches-mobile-cards">
            {batches.map((row) => (
              <li key={row.id ?? row.batchCode} className={styles.card} data-testid={`batch-mobile-card-${row.batchCode}`}>
                <div className={styles.cardTop}>
                  <Link to={`/batches/${row.id}`} className={styles.code}>
                    {row.batchCode}
                  </Link>
                  <span className={styles.badges}>
                    {row.status ? <StatusBadge status={row.status} /> : null}
                    {row.qualityCheck?.status === 'FAILED' ? <StatusBadge status="ON_HOLD" /> : null}
                  </span>
                </div>
                <div className={styles.cardProduct}>
                  {row.productName} <span className={styles.muted}>{row.sku}</span>
                </div>
                <div className={styles.cardBottom}>
                  <ShelfLifeRail packDate={row.packDate} expiryDate={row.expiryDate} daysUntilExpiry={row.daysUntilExpiry} status={row.status} />
                  <span className={styles.qty}>{S.quantity(row.quantityProduced, row.unit)}</span>
                </div>
              </li>
            ))}
          </ul>
          {total > 0 ? (
            <Pagination
              page={page}
              pageSize={limit}
              totalItems={total}
              onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
              onPageSizeChange={(nextLimit) => updateParams({ limit: String(nextLimit) })}
            />
          ) : null}
        </>
      )}

      {mayCreate ? <CreateBatchDialog open={createOpen || isNewRoute} onClose={handleCloseCreate} /> : null}
    </div>
  );
}
