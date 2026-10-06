import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import {
  createInspection,
  fetchBatches,
  fetchInspections,
  fetchMyInspections
} from '../../api/endpoints';
import type { ChecklistItemDto, InspectionDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canCreateInspection } from '../../auth/permissions.generated';
import {
  Button,
  Dialog,
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
  Textarea,
  useToast,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';

export const FIXED_CHECKLIST_LABELS: readonly string[] = [
  'Packaging integrity',
  'Label accuracy & legibility',
  'Expiry date visible & correct',
  'Weight / quantity correct',
  'No visible contamination',
  'Colour & texture acceptable',
  'Odour within acceptable range',
  'Storage conditions met'
] as const;

interface ChecklistFormItem {
  label: string;
  passed?: boolean | undefined;
  note: string;
}

function buildInitialChecklist(): ChecklistFormItem[] {
  return FIXED_CHECKLIST_LABELS.map((label) => ({
    label,
    passed: true,
    note: ''
  }));
}

export function InspectionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionDto | null>(null);

  // Create form state
  const [batchId, setBatchId] = useState('');
  const [verdict, setVerdict] = useState<'PASSED' | 'FLAGGED' | 'FAILED'>('PASSED');
  const [rating, setRating] = useState('5');
  const [checklist, setChecklist] = useState<ChecklistFormItem[]>(buildInitialChecklist);
  const [findings, setFindings] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const allowCreate = canCreateInspection(user);

  const allInspectionsQuery = useQuery({
    queryKey: ['inspections', 'all', { page, limit, statusFilter }],
    queryFn: () =>
      fetchInspections({
        page,
        limit,
        status: statusFilter || undefined
      }),
    enabled: activeTab === 'all'
  });

  const myInspectionsQuery = useQuery({
    queryKey: ['inspections', 'my'],
    queryFn: fetchMyInspections,
    enabled: activeTab === 'my'
  });

  const batchesForSelectQuery = useQuery({
    queryKey: ['batches', 'for-inspection-select'],
    queryFn: () => fetchBatches({ page: 1, limit: 100 }),
    enabled: createOpen
  });

  useEffect(() => {
    if (createOpen && batchesForSelectQuery.data?.data?.length && !batchId) {
      setBatchId(batchesForSelectQuery.data.data[0]?.id ?? '');
    }
  }, [createOpen, batchesForSelectQuery.data, batchId]);

  const resetCreateForm = () => {
    setVerdict('PASSED');
    setRating('5');
    setChecklist(buildInitialChecklist());
    setFindings('');
    setRecommendation('');
    setServerError(null);
    setFieldErrors({});
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsedRating = Number.parseInt(rating, 10);
      const formattedChecklist: ChecklistItemDto[] = checklist.map((item) => ({
        label: item.label,
        ...(item.passed !== undefined ? { passed: item.passed } : {}),
        ...(item.note.trim() ? { note: item.note.trim() } : {})
      }));
      return createInspection({
        batchId: batchId.trim(),
        status: verdict,
        rating: Number.isNaN(parsedRating) ? 3 : parsedRating,
        checklist: formattedChecklist,
        ...(findings.trim() ? { findings: findings.trim() } : {}),
        ...(recommendation.trim() ? { recommendation: recommendation.trim() } : {})
      });
    },
    onSuccess: async (res) => {
      setCreateOpen(false);
      resetCreateForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspections'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        res.data.batchId
          ? queryClient.invalidateQueries({ queryKey: ['batch', res.data.batchId] })
          : Promise.resolve()
      ]);
      pushToast({
        title: 'Inspection recorded',
        description: `Verdict ${res.data.status} recorded for batch ${res.data.batchCode ?? ''}.`,
        variant: 'success'
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          mapped[fe.field] = fe.message;
        }
        setFieldErrors(mapped);
      } else {
        setServerError(err instanceof Error ? err.message : 'Unable to record inspection.');
      }
    }
  });

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return;
    setServerError(null);
    setFieldErrors({});
    createMutation.mutate();
  };

  const updateChecklistItem = (
    idx: number,
    patch: Partial<ChecklistFormItem>
  ) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const rows: InspectionDto[] =
    activeTab === 'all'
      ? (allInspectionsQuery.data?.data ?? [])
      : (myInspectionsQuery.data ?? []);
  const total =
    activeTab === 'all' ? (allInspectionsQuery.data?.total ?? 0) : rows.length;
  const isLoading =
    activeTab === 'all' ? allInspectionsQuery.isPending : myInspectionsQuery.isPending;
  const isError =
    activeTab === 'all' ? allInspectionsQuery.isError : myInspectionsQuery.isError;
  const activeError =
    activeTab === 'all' ? allInspectionsQuery.error : myInspectionsQuery.error;

  const columns: TableColumn<InspectionDto>[] = [
    {
      key: 'batchCode',
      header: 'Batch',
      render: (row) => (
        <div>
          {row.batchId ? (
            <Link to={`/batches/${row.batchId}`} className={coreStyles.codeLink}>
              {row.batchCode}
            </Link>
          ) : (
            <span className={coreStyles.monoCode}>{row.batchCode}</span>
          )}
          <div className={coreStyles.metaLabel}>
            {row.productName} ({row.sku})
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Verdict',
      render: (row) =>
        row.status ? (
          <StatusBadge status={row.status as StatusBadgeValue} />
        ) : (
          <span>—</span>
        )
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => <strong>{row.rating} / 5</strong>
    },
    {
      key: 'inspector',
      header: 'Inspector',
      render: (row) => (
        <span>{row.inspectedBy?.name ?? row.inspectedBy?.username ?? '—'}</span>
      )
    },
    {
      key: 'createdAt',
      header: 'Inspected At',
      render: (row) => <span>{formatTimestamp(row.createdAt)}</span>
    },
    {
      key: 'actions',
      header: 'Record (Read-Only)',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Eye size={14} />}
          onClick={() => setSelectedInspection(row)}
          data-testid={`view-inspection-btn-${row.batchCode}`}
        >
          View Record
        </Button>
      )
    }
  ];

  return (
    <div className={coreStyles.pageStack} data-testid="inspections-page">
      <PageHeader
        title="Quality Inspections"
        subtitle="Permanent, append-only 8-point quality inspection records (D-13, D-15)."
        backdropKey="inspections"
        priority
        actions={
          allowCreate ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
              data-testid="open-create-inspection-btn"
            >
              Record Inspection
            </Button>
          ) : null
        }
      />

      <div className={coreStyles.tabBar} role="tablist" aria-label="Inspection views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`${coreStyles.tabBtn} ${activeTab === 'all' ? coreStyles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
          data-testid="tab-all-inspections"
        >
          All Inspections
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'my'}
          className={`${coreStyles.tabBtn} ${activeTab === 'my' ? coreStyles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('my')}
          data-testid="tab-my-inspections"
        >
          My Inspections
        </button>
      </div>

      {activeTab === 'all' ? (
        <section className={coreStyles.filterBar} aria-label="Inspection filters">
          <Field label="Filter by Verdict">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              data-testid="inspections-filter-status"
            >
              <option value="">All Verdicts</option>
              <option value="PASSED">PASSED</option>
              <option value="FLAGGED">FLAGGED</option>
              <option value="FAILED">FAILED</option>
            </Select>
          </Field>
        </section>
      ) : null}

      {isLoading ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading quality inspections" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load inspections"
          description={
            activeError instanceof Error
              ? activeError.message
              : 'Failed to load inspection records.'
          }
          requestId={activeError instanceof ApiError ? activeError.requestId : undefined}
          onRetry={() =>
            void (activeTab === 'all'
              ? allInspectionsQuery.refetch()
              : myInspectionsQuery.refetch())
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No inspection records found"
          description="Record a new 8-point quality inspection or adjust your filter."
        />
      ) : (
        <>
          <div className={coreStyles.desktopTableWrap}>
            <Table
              caption="Quality inspection records"
              columns={columns}
              data={rows}
              rowKey={(row) => row.id ?? `${row.batchCode}-${row.createdAt}`}
            />
          </div>

          <div className={coreStyles.mobileCardList}>
            {rows.map((row) => (
              <article
                key={row.id ?? `${row.batchCode}-${row.createdAt}`}
                className={coreStyles.itemCard}
              >
                <div className={coreStyles.itemCardHeader}>
                  <span className={coreStyles.monoCode}>{row.batchCode}</span>
                  {row.status ? (
                    <StatusBadge status={row.status as StatusBadgeValue} />
                  ) : null}
                </div>
                <div>
                  <strong>{row.productName}</strong> ({row.sku}) — Rating: {row.rating}/5
                </div>
                <div className={coreStyles.metaLabel}>
                  {row.inspectedBy?.name ?? '—'} • {formatTimestamp(row.createdAt)}
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Eye size={14} />}
                    onClick={() => setSelectedInspection(row)}
                  >
                    View Record
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {activeTab === 'all' ? (
            <Pagination
              page={page}
              pageSize={limit}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          ) : null}
        </>
      )}

      {/* Create Inspection Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          if (!createMutation.isPending) setCreateOpen(false);
        }}
        title="Record 8-Point Quality Inspection"
        description="Inspections are permanent and append-only. PASSED verdict is rejected by the server if any checklist item fails."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-inspection-form"
              isLoading={createMutation.isPending}
              disabled={createMutation.isPending}
              data-testid="submit-inspection-btn"
            >
              Submit Inspection
            </Button>
          </>
        }
      >
        <form
          id="create-inspection-form"
          onSubmit={handleCreateSubmit}
          className={coreStyles.pageStack}
          noValidate
        >
          {serverError ? (
            <div
              className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
              role="alert"
              data-testid="create-inspection-error"
            >
              <div>{serverError}</div>
              {fieldErrors.checklist ? (
                <div data-testid="inspection-checklist-field-error">
                  {fieldErrors.checklist}
                </div>
              ) : null}
            </div>
          ) : null}

          <Field label="Target Batch" required error={fieldErrors.batchId}>
            <Select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={createMutation.isPending}
              data-testid="inspection-batch-select"
            >
              <option value="">Select a batch…</option>
              {(batchesForSelectQuery.data?.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode} — {b.productName} ({b.sku})
                </option>
              ))}
            </Select>
          </Field>

          <div className={coreStyles.twoColumnGrid}>
            <Field label="Overall Verdict" required error={fieldErrors.status}>
              <Select
                value={verdict}
                onChange={(e) =>
                  setVerdict(e.target.value as 'PASSED' | 'FLAGGED' | 'FAILED')
                }
                disabled={createMutation.isPending}
                data-testid="inspection-verdict-select"
              >
                <option value="PASSED">PASSED — Cleared for dispatch</option>
                <option value="FLAGGED">FLAGGED — Dispatch permitted with advisory</option>
                <option value="FAILED">FAILED — Place batch on Quality Hold</option>
              </Select>
            </Field>

            <Field label="Quality Rating (1 to 5)" required error={fieldErrors.rating}>
              <Select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                disabled={createMutation.isPending}
                data-testid="inspection-rating-select"
              >
                <option value="5">5 — Excellent</option>
                <option value="4">4 — Good</option>
                <option value="3">3 — Acceptable</option>
                <option value="2">2 — Substandard</option>
                <option value="1">1 — Critical Failure</option>
              </Select>
            </Field>
          </div>

          <div className={coreStyles.checklistStack}>
            <span className={coreStyles.checklistLabel}>
              8-Point Quality Checklist (Pass / Fail / Not Assessed + Note up to 200 chars)
            </span>
            {checklist.map((item, idx) => (
              <div
                key={item.label ?? idx}
                className={coreStyles.checklistRow}
                data-testid={`checklist-item-${idx}`}
              >
                <div className={coreStyles.checklistTop}>
                  <span className={coreStyles.checklistLabel}>
                    {idx + 1}. {item.label}
                  </span>
                  <div
                    className={coreStyles.triStateGroup}
                    role="group"
                    aria-label={`${item.label} assessment`}
                  >
                    <button
                      type="button"
                      className={`${coreStyles.triBtn} ${
                        item.passed === true ? coreStyles.triBtnPass : ''
                      }`}
                      aria-pressed={item.passed === true}
                      onClick={() => updateChecklistItem(idx, { passed: true })}
                      disabled={createMutation.isPending}
                      data-testid={`checklist-pass-${idx}`}
                    >
                      Pass
                    </button>
                    <button
                      type="button"
                      className={`${coreStyles.triBtn} ${
                        item.passed === false ? coreStyles.triBtnFail : ''
                      }`}
                      aria-pressed={item.passed === false}
                      onClick={() => updateChecklistItem(idx, { passed: false })}
                      disabled={createMutation.isPending}
                      data-testid={`checklist-fail-${idx}`}
                    >
                      Fail
                    </button>
                    <button
                      type="button"
                      className={`${coreStyles.triBtn} ${
                        item.passed === undefined ? coreStyles.triBtnNa : ''
                      }`}
                      aria-pressed={item.passed === undefined}
                      onClick={() => updateChecklistItem(idx, { passed: undefined })}
                      disabled={createMutation.isPending}
                      data-testid={`checklist-na-${idx}`}
                    >
                      Not Assessed
                    </button>
                  </div>
                </div>
                <Input
                  aria-label={`Note for ${item.label}`}
                  maxLength={200}
                  value={item.note ?? ''}
                  onChange={(e) =>
                    updateChecklistItem(idx, { note: e.target.value.slice(0, 200) })
                  }
                  placeholder="Optional observation note (max 200 chars)…"
                  disabled={createMutation.isPending}
                  data-testid={`checklist-note-${idx}`}
                />
              </div>
            ))}
          </div>

          <Field label="Findings" error={fieldErrors.findings}>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Summarize laboratory or physical inspection findings…"
              disabled={createMutation.isPending}
              data-testid="inspection-findings-input"
            />
          </Field>

          <Field label="Recommendation" error={fieldErrors.recommendation}>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Recommended handling or dispatch disposition…"
              disabled={createMutation.isPending}
              data-testid="inspection-recommendation-input"
            />
          </Field>
        </form>
      </Dialog>

      {/* Read-Only Inspection Detail Dialog */}
      <Dialog
        open={Boolean(selectedInspection)}
        onClose={() => setSelectedInspection(null)}
        title={`Inspection Record — ${selectedInspection?.batchCode ?? ''}`}
        description="Read-only permanent quality record (D-15). Inspections cannot be modified or deleted after creation."
        actions={
          <Button variant="secondary" onClick={() => setSelectedInspection(null)}>
            Close
          </Button>
        }
      >
        {selectedInspection ? (
          <div className={coreStyles.pageStack} data-testid="inspection-readonly-detail">
            <div className={coreStyles.detailGrid}>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Verdict</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.status ? (
                    <StatusBadge status={selectedInspection.status as StatusBadgeValue} />
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Rating</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.rating} / 5
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Inspector</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.inspectedBy?.name ??
                    selectedInspection.inspectedBy?.username ??
                    '—'}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Inspected At</span>
                <span className={coreStyles.metaValue}>
                  {formatTimestamp(selectedInspection.createdAt)}
                </span>
              </div>
            </div>

            {selectedInspection.findings ? (
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Findings</span>
                <span className={coreStyles.metaValue}>{selectedInspection.findings}</span>
              </div>
            ) : null}

            {selectedInspection.recommendation ? (
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Recommendation</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.recommendation}
                </span>
              </div>
            ) : null}

            <div className={coreStyles.checklistStack}>
              <span className={coreStyles.checklistLabel}>8-Point Checklist Results</span>
              {(selectedInspection.checklist ?? []).map((item, idx) => (
                <div key={item.label ?? idx} className={coreStyles.checklistRow}>
                  <div className={coreStyles.checklistTop}>
                    <span className={coreStyles.checklistLabel}>
                      {idx + 1}. {item.label}
                    </span>
                    <strong>
                      {item.passed === true
                        ? 'PASS'
                        : item.passed === false
                          ? 'FAIL'
                          : 'NOT ASSESSED'}
                    </strong>
                  </div>
                  {item.note ? (
                    <div className={coreStyles.metaLabel}>Note: {item.note}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
