import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Plus, RotateCcw } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { fetchBatches, fetchProducts } from '../../api/endpoints';
import type { BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import {
  canCreateBatch,
  canViewArchivedBatches
} from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { CreateBatchDialog } from './CreateBatchDialog';

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'All Freshness & Lifecycle Tiers' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'READY', label: 'Ready' },
  { value: 'EXCEPTION', label: 'Exception' },
  { value: 'DISPATCHED', label: 'Dispatched' }
];

const SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Default (Expiry Date Asc)' },
  { value: 'expiryDate:asc', label: 'Expiry Date (Earliest First)' },
  { value: 'expiryDate:desc', label: 'Expiry Date (Latest First)' },
  { value: 'batchCode:asc', label: 'Batch Code (A–Z)' },
  { value: 'batchCode:desc', label: 'Batch Code (Z–A)' },
  { value: 'productName:asc', label: 'Product Name (A–Z)' },
  { value: 'createdAt:desc', label: 'Newest Created First' },
  { value: 'quantityProduced:desc', label: 'Quantity (High to Low)' }
];

export function BatchesPage({ openCreateInitially = false }: { openCreateInitially?: boolean }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isNewRoute = openCreateInitially || location.pathname === '/batches/new';
  const [createOpen, setCreateOpen] = useState(isNewRoute);

  const status = searchParams.get('status') ?? '';
  const sku = searchParams.get('sku') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim() === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });

  const batchesQuery = useQuery({
    queryKey: ['batches', { page, limit, status, sku, search, sort }],
    queryFn: () =>
      fetchBatches({
        page,
        limit,
        status: status || undefined,
        sku: sku || undefined,
        search: search || undefined,
        sort: sort || undefined
      })
  });

  const batches = batchesQuery.data?.data ?? [];
  const total = batchesQuery.data?.total ?? 0;

  const columns: TableColumn<BatchSummaryDto>[] = [
    {
      key: 'batchCode',
      header: 'Batch Code',
      render: (row) => (
        <Link
          to={`/batches/${row.id}`}
          className={coreStyles.codeLink}
          data-testid={`batch-link-${row.batchCode}`}
        >
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
      header: 'Freshness Status',
      render: (row) =>
        row.status ? (
          <StatusBadge status={row.status} />
        ) : (
          <span>—</span>
        )
    },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (row) => (
        <div>
          <div data-testid={`batch-expiry-${row.batchCode}`}>
            {formatBusinessDate(row.expiryDate)}
          </div>
          <div className={coreStyles.metaLabel}>
            {row.status === 'EXCEPTION'
              ? (row.exceptionReason ?? 'Invalid expiry')
              : `${row.daysUntilExpiry ?? '—'}d`}
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
      key: 'quantity',
      header: 'Quantity',
      render: (row) => (
        <span>
          {row.quantityProduced} {row.unit}
        </span>
      )
    },
    {
      key: 'source',
      header: 'Source Lot / Village',
      render: (row) => (
        <div>
          <div className={coreStyles.monoCode}>{row.sourceLotCode}</div>
          <div className={coreStyles.metaLabel}>{row.village}</div>
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

  return (
    <div className={coreStyles.pageStack} data-testid="batches-page">
      <PageHeader
        title="Production Batches"
        subtitle="Track provenance, server-derived freshness status tiers, and quality verdicts across all batches."
        backdropKey="batches"
        priority
        actions={
          <div className={coreStyles.inlineRow}>
            {canViewArchivedBatches(user) ? (
              <Link to="/batches/archived">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Archive size={15} />}
                  data-testid="view-archived-batches-btn"
                >
                  Archived Batches
                </Button>
              </Link>
            ) : null}
            {canCreateBatch(user) ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => setCreateOpen(true)}
                data-testid="open-create-batch-btn"
              >
                Create Batch
              </Button>
            ) : null}
          </div>
        }
      />

      <section className={coreStyles.filterBar} aria-label="Batch filters">
        <Field label="Freshness / Lifecycle Tier">
          <Select
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            data-testid="batches-filter-status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Product SKU">
          <Select
            value={sku}
            onChange={(e) => updateParam('sku', e.target.value)}
            data-testid="batches-filter-sku"
          >
            <option value="">All SKUs</option>
            {(productsQuery.data ?? []).map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.productName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Search (Code, Product, Lot, Farmer)">
          <Input
            type="search"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            placeholder="Search batch code, product, lot…"
            data-testid="batches-filter-search"
          />
        </Field>

        <Field label="Sort Order">
          <Select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            data-testid="batches-filter-sort"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className={coreStyles.filterActions}>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={resetFilters}
            data-testid="batches-reset-filters-btn"
          >
            Reset
          </Button>
        </div>
      </section>

      {batchesQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading production batches" />
        </div>
      ) : batchesQuery.isError ? (
        <ErrorState
          title="Unable to load batches"
          description={
            batchesQuery.error instanceof Error
              ? batchesQuery.error.message
              : 'Failed to load batch list.'
          }
          requestId={
            batchesQuery.error instanceof ApiError ? batchesQuery.error.requestId : undefined
          }
          onRetry={() => void batchesQuery.refetch()}
        />
      ) : batches.length === 0 ? (
        <EmptyState
          title="No matching batches found"
          description="Try clearing your search or status filter, or create a new production batch."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <>
          <div className={coreStyles.desktopTableWrap} data-testid="batches-desktop-table">
            <Table
              caption="Production batches"
              columns={columns}
              data={batches}
              rowKey={(row) => row.id ?? row.batchCode ?? ''}
            />
          </div>

          <div className={coreStyles.mobileCardList} data-testid="batches-mobile-cards">
            {batches.map((row) => (
              <article
                key={row.id ?? row.batchCode}
                className={coreStyles.itemCard}
                data-testid={`batch-mobile-card-${row.batchCode}`}
              >
                <div className={coreStyles.itemCardHeader}>
                  <Link to={`/batches/${row.id}`} className={coreStyles.codeLink}>
                    {row.batchCode}
                  </Link>
                  <div className={coreStyles.inlineRow}>
                    {row.status ? <StatusBadge status={row.status} /> : null}
                    {row.qualityCheck?.status ? (
                      <StatusBadge status={row.qualityCheck.status as StatusBadgeValue} />
                    ) : null}
                  </div>
                </div>
                <div>
                  <strong>{row.productName}</strong> ({row.sku})
                </div>
                <div className={coreStyles.itemCardMetaGrid}>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Pack Date</span>
                    <span className={coreStyles.metaValue}>
                      {formatBusinessDate(row.packDate)}
                    </span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Expiry Date</span>
                    <span className={coreStyles.metaValue}>
                      {formatBusinessDate(row.expiryDate)}
                    </span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Quantity</span>
                    <span className={coreStyles.metaValue}>
                      {row.quantityProduced} {row.unit}
                    </span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Source Lot</span>
                    <span className={coreStyles.metaValue}>{row.sourceLotCode}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={limit}
            totalItems={total}
            onPageChange={(nextPage) => updateParam('page', String(nextPage))}
            onPageSizeChange={(nextLimit) => updateParam('limit', String(nextLimit))}
          />
        </>
      )}

      {canCreateBatch(user) ? (
        <CreateBatchDialog open={createOpen || isNewRoute} onClose={handleCloseCreate} />
      ) : null}
    </div>
  );
}
