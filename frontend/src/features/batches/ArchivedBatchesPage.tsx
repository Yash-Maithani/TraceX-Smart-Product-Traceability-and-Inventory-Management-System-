import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
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
  Skeleton,
  StatusBadge,
  Table,
  useToast,
  type TableColumn
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';

export function ArchivedBatchesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
        title: 'Batch restored',
        description: `${res.data.batchCode ?? 'Batch'} has been restored to active inventory.`,
        variant: 'success'
      });
    },
    onError: (err) => {
      setRestoringId(null);
      pushToast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Unable to restore archived batch.',
        variant: 'error'
      });
    }
  });

  const archivedList = archivedQuery.data ?? [];
  const allowRestore = canRestoreBatch(user);

  const columns: TableColumn<BatchDetailDto>[] = [
    {
      key: 'batchCode',
      header: 'Batch Code',
      render: (row) => (
        <span className={coreStyles.monoCode} data-testid={`archived-code-${row.batchCode}`}>
          {row.batchCode}
        </span>
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
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (row) => <span>{formatBusinessDate(row.expiryDate)}</span>
    },
    {
      key: 'deletedInfo',
      header: 'Archived By / Reason',
      render: (row) => (
        <div>
          <div>{row.deleteNote ?? '—'}</div>
          <div className={coreStyles.metaLabel}>
            {row.deletedBy ?? '—'} • {formatTimestamp(row.deletedAt)}
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
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
            Restore
          </Button>
        ) : (
          <StatusBadge status="ARCHIVED" />
        )
    }
  ];

  return (
    <div className={coreStyles.pageStack} data-testid="archived-batches-page">
      <PageHeader
        title="Archived Batches"
        subtitle="Soft-deleted production batches. Administrators can restore batches back to active inventory."
        breadcrumbs={[
          { label: 'Batches', href: '/batches' },
          { label: 'Archived' }
        ]}
        backdropKey="batches"
        priority
        actions={
          <Link to="/batches">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={15} />}>
              Active Batches
            </Button>
          </Link>
        }
      />

      {archivedQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading archived batches" />
        </div>
      ) : archivedQuery.isError ? (
        <ErrorState
          title="Unable to load archived batches"
          description={
            archivedQuery.error instanceof Error
              ? archivedQuery.error.message
              : 'Failed to load archived batches.'
          }
          requestId={
            archivedQuery.error instanceof ApiError ? archivedQuery.error.requestId : undefined
          }
          onRetry={() => void archivedQuery.refetch()}
        />
      ) : archivedList.length === 0 ? (
        <EmptyState
          title="No archived batches"
          description="There are currently no soft-deleted batches in the archive."
        />
      ) : (
        <>
          <div className={coreStyles.desktopTableWrap}>
            <Table
              caption="Archived production batches"
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
                  <span className={coreStyles.metaLabel}>Archive Note</span>
                  <span className={coreStyles.metaValue}>{row.deleteNote ?? '—'}</span>
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
                      Restore
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
