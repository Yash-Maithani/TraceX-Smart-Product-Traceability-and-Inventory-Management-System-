import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import coreStyles from '../core/core.module.css';
import styles from './batches.module.css';
import { BatchListTabs } from './BatchListTabs';
import { BATCH_STRINGS } from '../../strings/batches';
import { ApiError } from '../../api/client';
import { fetchArchivedBatches, restoreBatch } from '../../api/endpoints';
import type { BatchDetailDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canRestoreBatch } from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
  Table,
  useToast,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';

const S = BATCH_STRINGS.archived;
const PAGE_SIZE = 20;

export function ArchivedBatchesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const archivedQuery = useQuery({
    queryKey: ['batches', 'archived'],
    queryFn: fetchArchivedBatches
  });

  const restoreMutation = useMutation({
    mutationFn: async (batchId: string) => {
      setRestoringId(batchId);
      return restoreBatch(batchId);
    },
    onSuccess: async (res) => {
      setRestoringId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches', 'archived'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        res.data.id
          ? queryClient.invalidateQueries({ queryKey: ['batch', res.data.id] })
          : Promise.resolve()
      ]);
      pushToast({
        title: S.restoredTitle,
        description: S.restoredBody(res.data.batchCode ?? ''),
        variant: 'success'
      });
    },
    onError: (err) => {
      setRestoringId(null);
      pushToast({
        title: S.restoreFailed,
        description: err instanceof Error ? err.message : undefined,
        variant: 'error'
      });
    }
  });

  const allArchived = archivedQuery.data ?? [];
  // The archived endpoint returns the whole list, so search and paging happen here
  const q = search.trim().toLowerCase();
  const filtered = q
    ? allArchived.filter((b) =>
        [b.batchCode, b.productName, b.sku, b.deleteNote].some((v) => (v ?? '').toLowerCase().includes(q))
      )
    : allArchived;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const archivedList = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allowRestore = canRestoreBatch(user);

  const columns: TableColumn<BatchDetailDto>[] = [
    {
      key: 'batchCode',
      header: S.columns.code,
      nowrap: true,
      render: (row) => (
        <span className={coreStyles.monoCode} data-testid={`archived-code-${row.batchCode}`}>
          {row.batchCode}
        </span>
      )
    },
    {
      key: 'productName',
      header: S.columns.product,
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
      key: 'expiryDate',
      header: S.columns.expires,
      nowrap: true,
      render: (row) => <span>{formatBusinessDate(row.expiryDate)}</span>
    },
    {
      key: 'deletedInfo',
      header: S.columns.archived,
      render: (row) => (
        <div>
          <div>{row.deleteNote ?? EMPTY_VALUE}</div>
          <div className={coreStyles.metaLabel}>
            {S.by(row.deletedBy ?? EMPTY_VALUE, formatTimestamp(row.deletedAt))}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      header: S.columns.action,
      render: (row) =>
        allowRestore && row.id ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            isLoading={restoringId === row.id && restoreMutation.isPending}
            disabled={restoreMutation.isPending}
            onClick={() => restoreMutation.mutate(row.id!)}
            data-testid={`restore-batch-btn-${row.batchCode}`}
          >
            {S.restore}
          </Button>
        ) : (
          <StatusBadge status="ARCHIVED" />
        )
    }
  ];

  return (
    <div className={coreStyles.pageStack} data-testid="archived-batches-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={archivedQuery.isSuccess ? <span className={styles.countChip}>{S.count(allArchived.length)}</span> : undefined}
        backdropKey="batches"
        priority
      />

      <BatchListTabs />

      {allArchived.length > 0 ? (
        <section className={styles.toolbar} aria-label={S.searchLabel}>
          <label className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{S.searchLabel}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={S.searchPlaceholder}
              data-testid="archived-search"
            />
          </label>
        </section>
      ) : null}

      {archivedQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label={S.loading} />
        </div>
      ) : archivedQuery.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={archivedQuery.error instanceof Error ? archivedQuery.error.message : BATCH_STRINGS.errorBody}
          requestId={
            archivedQuery.error instanceof ApiError ? archivedQuery.error.requestId : undefined
          }
          onRetry={() => void archivedQuery.refetch()}
        />
      ) : allArchived.length === 0 ? (
        <EmptyState title={S.emptyTitle} description={S.emptyBody} />
      ) : filtered.length === 0 ? (
        <EmptyState title={S.noMatchTitle} description={S.noMatchBody} />
      ) : (
        <>
          <div className={coreStyles.desktopTableWrap}>
            <Table
              caption={S.caption}
              columns={columns}
              data={archivedList}
              rowKey={(row) => row.id ?? row.batchCode ?? ''}
            />
          </div>

          <div className={coreStyles.mobileCardList}>
            {archivedList.map((row) => (
              <article
                key={row.id ?? row.batchCode}
                className={coreStyles.itemCard}
                data-testid={`archived-mobile-card-${row.batchCode}`}
              >
                <div className={coreStyles.itemCardHeader}>
                  <span className={coreStyles.monoCode}>{row.batchCode}</span>
                  <StatusBadge status="ARCHIVED" />
                </div>
                <div>
                  <strong>{row.productName}</strong> ({row.sku})
                </div>
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>{S.columns.archived}</span>
                  <span className={coreStyles.metaValue}>{row.deleteNote ?? EMPTY_VALUE}</span>
                </div>
                {allowRestore && row.id ? (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<RotateCcw size={14} />}
                      isLoading={restoringId === row.id && restoreMutation.isPending}
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(row.id!)}
                    >
                      {S.restore}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {filtered.length > PAGE_SIZE ? (
            <Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
