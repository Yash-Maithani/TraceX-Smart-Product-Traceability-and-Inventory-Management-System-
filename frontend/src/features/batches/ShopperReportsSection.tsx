import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { fetchBatchReports, resolveProductReport } from '../../api/endpoints';
import type { ProductReportDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canResolveShopperReports } from '../../auth/permissions.generated';
import { Button, Dialog, EmptyState, ErrorState, Field, Skeleton, StatusBadge, Textarea, useToast } from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { REPORT_STRINGS as R } from '../../strings/reports';

/** Problems shoppers reported from this batch's QR page (pick-list #2). Readers are the inspection readers. */
export function ShopperReportsSection({ batchId }: { batchId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const canResolve = canResolveShopperReports(user);
  const [resolving, setResolving] = useState<ProductReportDto | null>(null);
  const [note, setNote] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['batch', batchId, 'reports'],
    queryFn: () => fetchBatchReports(batchId)
  });

  const resolveMutation = useMutation({
    mutationFn: (report: ProductReportDto) => resolveProductReport(report.id ?? '', note.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId, 'reports'] });
      pushToast({ title: R.resolvedToast, variant: 'success' });
      setResolving(null);
    },
    onError: (err) => {
      pushToast({ title: R.resolveFailed, description: err instanceof Error ? err.message : undefined, variant: 'error' });
    }
  });

  const reports = reportsQuery.data ?? [];
  const openCount = reports.filter((r) => r.status === 'OPEN').length;

  return (
    <section className={coreStyles.sectionCard} data-testid="batch-reports-section">
      <div className={coreStyles.sectionHeader}>
        <div>
          <h2 className={coreStyles.sectionTitle}>{R.heading}</h2>
          <p className={coreStyles.sectionSubtitle}>{R.subtitle}</p>
        </div>
        {openCount > 0 ? (
          <span data-testid="batch-reports-open-count">
            <StatusBadge status="pending" labelOverride={R.openCount(openCount)} />
          </span>
        ) : null}
      </div>

      {reportsQuery.isPending ? (
        <Skeleton label={R.loading} />
      ) : reportsQuery.isError ? (
        <ErrorState
          title={R.loadFailed}
          description={reportsQuery.error instanceof Error ? reportsQuery.error.message : R.loadFailed}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : reports.length === 0 ? (
        <EmptyState title={R.emptyTitle} description={R.emptyBody} />
      ) : (
        <ul className={coreStyles.timelineList} data-testid="batch-reports-list">
          {reports.map((r) => (
            <li key={r.id} className={coreStyles.timelineItem} data-testid="batch-report-item">
              <div className={coreStyles.itemCardHeader}>
                <div className={coreStyles.inlineRow}>
                  <StatusBadge
                    status={r.status === 'RESOLVED' ? 'approved' : 'pending'}
                    labelOverride={r.status === 'RESOLVED' ? R.resolved : R.open}
                  />
                  <strong>{R.categoryLabel(r.category)}</strong>
                </div>
                <span className={coreStyles.metaLabel}>{r.createdAt ? formatTimestamp(r.createdAt) : ''}</span>
              </div>
              <div>{r.message}</div>
              <div className={coreStyles.metaLabel}>
                {R.contact}: {r.contact ?? R.noContact}
              </div>
              {r.status === 'RESOLVED' ? (
                <div className={coreStyles.metaLabel}>
                  {R.resolvedBy(r.resolvedByName ?? '', r.resolvedAt ? formatTimestamp(r.resolvedAt) : '')}
                  {r.resolutionNote ? `. ${r.resolutionNote}` : ''}
                </div>
              ) : canResolve ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNote('');
                      setResolving(r);
                    }}
                    data-testid="batch-report-resolve"
                  >
                    {R.resolve}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={resolving !== null}
        onClose={() => {
          if (!resolveMutation.isPending) setResolving(null);
        }}
        title={R.resolveTitle}
        description={R.resolveDescription}
        actions={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)} disabled={resolveMutation.isPending}>
              {R.cancel}
            </Button>
            <Button
              variant="primary"
              isLoading={resolveMutation.isPending}
              onClick={() => resolving && resolveMutation.mutate(resolving)}
              data-testid="batch-report-resolve-confirm"
            >
              {R.confirm}
            </Button>
          </>
        }
      >
        <Field label={R.note}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} data-testid="batch-report-note" />
        </Field>
      </Dialog>
    </section>
  );
}
