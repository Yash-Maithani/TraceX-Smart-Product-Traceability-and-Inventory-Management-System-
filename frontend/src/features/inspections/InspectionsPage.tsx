import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import batchStyles from '../batches/batches.module.css';
import styles from './inspections.module.css';
import { ApiError } from '../../api/client';
import {
  createInspection,
  draftInspectionFromNotes,
  fetchAiStatus,
  fetchBatches,
  fetchInspections,
  fetchMyInspections
} from '../../api/endpoints';
import type { ChecklistItemDto, InspectionDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canCreateInspection } from '../../auth/permissions.generated';
import {
  Button,
  DateRangeChip,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FilterChip,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Tabs,
  Textarea,
  useToast,
  type StatusBadgeValue,
  type TableColumn
} from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';
import { INSPECTION_STRINGS as S } from '../../strings/inspections';
import { AI_STRINGS } from '../../strings/ai';
import { STATUS_STRINGS } from '../../strings/status';
import { RecordComments } from '../messages/RecordComments';

/** Fixed by the server (InspectionService.FIXED_CHECKLIST_LABELS); the labels are stored with each inspection. */
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

const VERDICTS = ['PASSED', 'FLAGGED', 'FAILED'] as const;
type Verdict = (typeof VERDICTS)[number];
const VERDICT_OPTIONS = VERDICTS.map((v) => ({ value: v, label: STATUS_STRINGS[v] }));

interface ChecklistFormItem {
  label: string;
  passed?: boolean | undefined;
  note: string;
}

function buildInitialChecklist(): ChecklistFormItem[] {
  return FIXED_CHECKLIST_LABELS.map((label) => ({ label, passed: true, note: '' }));
}

function verdictLabel(status: string | undefined): string {
  return status ? (STATUS_STRINGS as Record<string, string>)[status] ?? status : EMPTY_VALUE;
}

export function InspectionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  // Tab and filters live in the URL so a dashboard tile can open e.g. /inspections?verdict=FAILED
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'all' | 'mine' = searchParams.get('tab') === 'mine' ? 'mine' : 'all';
  const verdictParam = searchParams.get('verdict') ?? '';
  const statusFilter = (VERDICTS as readonly string[]).includes(verdictParam) ? verdictParam : '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionDto | null>(null);

  // Create form state
  const [batchId, setBatchId] = useState('');
  const [verdict, setVerdict] = useState<Verdict>('PASSED');
  const [rating, setRating] = useState('5');
  const [checklist, setChecklist] = useState<ChecklistFormItem[]>(buildInitialChecklist);
  const [findings, setFindings] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Inspection assistant (AI phase): notes become a draft the inspector reviews
  const [notes, setNotes] = useState('');
  const [draftMessage, setDraftMessage] = useState<{ text: string; adjustments: string[] } | null>(null);

  const allowCreate = canCreateInspection(user);
  const aiStatusQuery = useQuery({ queryKey: ['ai', 'status'], queryFn: fetchAiStatus, enabled: allowCreate, staleTime: 300_000 });
  const aiEnabled = allowCreate && aiStatusQuery.data?.enabled === true;
  const range = { from: from || undefined, to: to || undefined };

  const allInspectionsQuery = useQuery({
    queryKey: ['inspections', 'all', { page, limit, statusFilter, from, to }],
    queryFn: () => fetchInspections({ page, limit, status: statusFilter || undefined, ...range })
  });

  const myInspectionsQuery = useQuery({
    queryKey: ['inspections', 'my', { page, limit, from, to }],
    queryFn: () => fetchMyInspections({ page: activeTab === 'mine' ? page : 1, limit, ...range })
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
    setNotes('');
    setDraftMessage(null);
  };

  const draftMutation = useMutation({
    mutationFn: () => draftInspectionFromNotes(notes.trim()),
    onSuccess: (draft) => {
      const v = draft.verdict;
      if (v === 'PASSED' || v === 'FLAGGED' || v === 'FAILED') setVerdict(v);
      if (draft.rating) setRating(String(draft.rating));
      if (draft.checklist && draft.checklist.length === FIXED_CHECKLIST_LABELS.length) {
        setChecklist(
          draft.checklist.map((c, i) => ({
            label: FIXED_CHECKLIST_LABELS[i] ?? c.label ?? '',
            passed: c.passed === true ? true : c.passed === false ? false : undefined,
            note: (c.note ?? '').slice(0, 200)
          }))
        );
      }
      if (draft.findings) setFindings(draft.findings);
      if (draft.recommendation) setRecommendation(draft.recommendation);
      setDraftMessage({ text: AI_STRINGS.draft.filled, adjustments: draft.adjustments ?? [] });
    },
    onError: (err) => {
      setDraftMessage({ text: err instanceof Error && err.message ? err.message : AI_STRINGS.draft.failed, adjustments: [] });
    }
  });

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
        res.data.batchId ? queryClient.invalidateQueries({ queryKey: ['batch', res.data.batchId] }) : Promise.resolve()
      ]);
      pushToast({
        title: S.dialog.successTitle,
        description: S.dialog.successBody(verdictLabel(res.data.status), res.data.batchCode ?? ''),
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
        setServerError(err instanceof Error ? err.message : S.dialog.failed);
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

  const updateChecklistItem = (idx: number, patch: Partial<ChecklistFormItem>) => {
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const activeQuery = activeTab === 'all' ? allInspectionsQuery : myInspectionsQuery;
  const rows: InspectionDto[] = activeQuery.data?.data ?? [];
  const total = activeQuery.data?.total ?? 0;
  const anyFilter = Boolean(statusFilter || from || to);
  const verdictGuard = verdict === 'PASSED' && checklist.some((item) => item.passed === false);

  const openRecord = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const columns: TableColumn<InspectionDto>[] = [
    {
      key: 'batchCode',
      header: S.columns.batch,
      render: (row) => (
        <div className={batchStyles.product}>
          {row.batchId ? (
            <Link to={`/batches/${row.batchId}`} className={batchStyles.code}>
              {row.batchCode}
            </Link>
          ) : (
            <span className={batchStyles.code}>{row.batchCode}</span>
          )}
          <span>{row.productName}</span>
          <span className={batchStyles.muted}>{row.sku}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: S.columns.verdict,
      nowrap: true,
      render: (row) => (row.status ? <StatusBadge status={row.status as StatusBadgeValue} /> : <span>{EMPTY_VALUE}</span>)
    },
    {
      key: 'rating',
      header: S.columns.rating,
      nowrap: true,
      numeric: true,
      render: (row) => S.rating(row.rating)
    },
    {
      key: 'inspector',
      header: S.columns.inspector,
      render: (row) => <span>{row.inspectedBy?.name ?? row.inspectedBy?.username ?? EMPTY_VALUE}</span>
    },
    {
      key: 'createdAt',
      header: S.columns.recorded,
      nowrap: true,
      render: (row) => <span>{formatTimestamp(row.createdAt)}</span>
    },
    {
      key: 'actions',
      header: S.columns.action,
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Eye size={14} />}
          onClick={() => setSelectedInspection(row)}
          aria-label={S.viewLabel(row.batchCode ?? '')}
          data-testid={`view-inspection-btn-${row.batchCode}`}
        >
          {S.view}
        </Button>
      )
    }
  ];

  const emptyState = anyFilter ? (
    <EmptyState
      title={S.emptyNoMatchTitle}
      description={S.emptyNoMatchBody}
      action={
        <Button variant="secondary" onClick={() => updateParams({ verdict: '', from: '', to: '' })}>
          {S.clearFilters}
        </Button>
      }
    />
  ) : activeTab === 'mine' ? (
    <EmptyState title={S.emptyMineTitle} description={S.emptyMineBody} />
  ) : (
    <EmptyState
      title={S.emptyTitle}
      description={allowCreate ? S.emptyCanRecord : S.emptyCannotRecord}
      action={
        allowCreate ? (
          <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openRecord}>
            {S.record}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className={batchStyles.page} data-testid="inspections-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={allInspectionsQuery.data ? <span className={batchStyles.countChip}>{S.count(allInspectionsQuery.data.total ?? 0)}</span> : undefined}
        backdropKey="inspections"
        priority
        actions={
          allowCreate ? (
            <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={openRecord} data-testid="open-create-inspection-btn">
              {S.record}
            </Button>
          ) : null
        }
      />

      <Tabs
        label={S.tabsLabel}
        idPrefix="inspections"
        selectedId={activeTab}
        onSelect={(id) => updateParams({ tab: id === 'mine' ? 'mine' : '' })}
        tabs={[
          { id: 'all', label: S.tabs.all, count: allInspectionsQuery.data?.total, testId: 'tab-all-inspections' },
          { id: 'mine', label: S.tabs.mine, count: myInspectionsQuery.data?.total, testId: 'tab-my-inspections' }
        ]}
      />

      <section className={batchStyles.toolbar} aria-label={S.filtersLabel}>
        {activeTab === 'all' ? (
          <FilterChip
            label={S.verdictFilter}
            value={statusFilter}
            options={VERDICT_OPTIONS}
            onChange={(v) => updateParams({ verdict: v })}
            testId="inspections-filter-status"
          />
        ) : null}
        <DateRangeChip
          label={S.dateFilter}
          fromLabel={S.dateFrom}
          toLabel={S.dateTo}
          from={from}
          to={to}
          onApply={(f, t) => updateParams({ from: f, to: t })}
          testId="inspections-filter-date"
        />
        {anyFilter ? (
          <button
            type="button"
            className={batchStyles.clearLink}
            onClick={() => updateParams({ verdict: '', from: '', to: '' })}
            data-testid="inspections-clear-filters"
          >
            {S.clearFilters}
          </button>
        ) : null}
      </section>

      <div id={`inspections-panel-${activeTab}`} role="tabpanel" aria-labelledby={`inspections-tab-${activeTab}`}>
        {activeQuery.isPending ? (
          <div className={coreStyles.sectionCard} aria-busy="true">
            <Skeleton label={S.loading} />
          </div>
        ) : activeQuery.isError ? (
          <ErrorState
            title={S.errorTitle}
            description={activeQuery.error instanceof ApiError ? activeQuery.error.message : S.errorBody}
            requestId={activeQuery.error instanceof ApiError ? activeQuery.error.requestId : undefined}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          emptyState
        ) : (
          <div className={batchStyles.page}>
            <div className={batchStyles.desktopOnly}>
              <Table
                caption={S.caption}
                columns={columns}
                data={rows}
                rowKey={(row) => row.id ?? `${row.batchCode}-${row.createdAt}`}
              />
            </div>
            <ul className={batchStyles.mobileList}>
              {rows.map((row) => (
                <li key={row.id ?? `${row.batchCode}-${row.createdAt}`} className={batchStyles.card}>
                  <div className={batchStyles.cardTop}>
                    <span className={batchStyles.code}>{row.batchCode}</span>
                    {row.status ? <StatusBadge status={row.status as StatusBadgeValue} /> : null}
                  </div>
                  <div className={batchStyles.cardProduct}>
                    {row.productName} <span className={batchStyles.muted}>{row.sku}</span>
                  </div>
                  <div className={batchStyles.cardBottom}>
                    <span className={batchStyles.muted}>
                      {row.inspectedBy?.name ?? EMPTY_VALUE}, {formatTimestamp(row.createdAt)}. {S.rating(row.rating)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Eye size={14} />}
                      onClick={() => setSelectedInspection(row)}
                      aria-label={S.viewLabel(row.batchCode ?? '')}
                    >
                      {S.view}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={limit} totalItems={total} onPageChange={setPage} onPageSizeChange={setLimit} />
          </div>
        )}
      </div>

      {/* Record inspection dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          if (!createMutation.isPending) setCreateOpen(false);
        }}
        title={S.dialog.title}
        description={S.dialog.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              {S.dialog.cancel}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-inspection-form"
              isLoading={createMutation.isPending}
              disabled={createMutation.isPending}
              data-testid="submit-inspection-btn"
            >
              {S.dialog.submit}
            </Button>
          </>
        }
      >
        <form id="create-inspection-form" onSubmit={handleCreateSubmit} className={coreStyles.pageStack} noValidate>
          {serverError ? (
            <div className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`} role="alert" data-testid="create-inspection-error">
              <div>{serverError}</div>
              {fieldErrors.checklist ? <div data-testid="inspection-checklist-field-error">{fieldErrors.checklist}</div> : null}
            </div>
          ) : null}

          {aiEnabled ? (
            <div className={styles.assistant} data-testid="inspection-assistant">
              <Field label={AI_STRINGS.draft.label} hint={AI_STRINGS.draft.hint}>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                  placeholder={AI_STRINGS.draft.placeholder}
                  disabled={createMutation.isPending || draftMutation.isPending}
                  rows={3}
                  data-testid="inspection-notes-input"
                />
              </Field>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Sparkles size={15} />}
                  isLoading={draftMutation.isPending}
                  loadingText={AI_STRINGS.draft.filling}
                  disabled={draftMutation.isPending || notes.trim().length < 10}
                  onClick={() => draftMutation.mutate()}
                  data-testid="inspection-draft-btn"
                >
                  {AI_STRINGS.draft.fill}
                </Button>
              </div>
              {draftMessage ? (
                <div className={styles.assistantNote} role="status" data-testid="inspection-draft-message">
                  <p>{draftMessage.text}</p>
                  {draftMessage.adjustments.length > 0 ? (
                    <p>
                      {AI_STRINGS.draft.adjusted} {draftMessage.adjustments.join(' ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <Field label={S.dialog.batch} required error={fieldErrors.batchId}>
            <Select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={createMutation.isPending}
              data-testid="inspection-batch-select"
            >
              <option value="">{S.dialog.batchPlaceholder}</option>
              {(batchesForSelectQuery.data?.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode}, {b.productName} ({b.sku})
                </option>
              ))}
            </Select>
          </Field>

          <div className={coreStyles.twoColumnGrid}>
            <Field label={S.dialog.verdict} required error={fieldErrors.status}>
              <Select
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as Verdict)}
                disabled={createMutation.isPending}
                data-testid="inspection-verdict-select"
              >
                {VERDICTS.map((v) => (
                  <option key={v} value={v}>
                    {S.dialog.verdicts[v]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={S.dialog.rating} required error={fieldErrors.rating}>
              <Select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                disabled={createMutation.isPending}
                data-testid="inspection-rating-select"
              >
                {['5', '4', '3', '2', '1'].map((r) => (
                  <option key={r} value={r}>
                    {S.dialog.ratings[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className={styles.checklist}>
            <legend className={coreStyles.checklistLabel}>{S.dialog.checklist}</legend>
            <p className={styles.hint}>{S.dialog.checklistHint}</p>
            <div className={styles.checklistGrid}>
              {checklist.map((item, idx) => (
                <div key={item.label ?? idx} className={styles.checkItem} data-testid={`checklist-item-${idx}`}>
                  <div className={coreStyles.checklistTop}>
                    <span className={styles.checkLabel}>{item.label}</span>
                    <div className={coreStyles.triStateGroup} role="group" aria-label={item.label}>
                      <button
                        type="button"
                        className={`${coreStyles.triBtn} ${item.passed === true ? coreStyles.triBtnPass : ''}`}
                        aria-pressed={item.passed === true}
                        onClick={() => updateChecklistItem(idx, { passed: true })}
                        disabled={createMutation.isPending}
                        data-testid={`checklist-pass-${idx}`}
                      >
                        {S.dialog.pass}
                      </button>
                      <button
                        type="button"
                        className={`${coreStyles.triBtn} ${item.passed === false ? coreStyles.triBtnFail : ''}`}
                        aria-pressed={item.passed === false}
                        onClick={() => updateChecklistItem(idx, { passed: false })}
                        disabled={createMutation.isPending}
                        data-testid={`checklist-fail-${idx}`}
                      >
                        {S.dialog.fail}
                      </button>
                      <button
                        type="button"
                        className={`${coreStyles.triBtn} ${item.passed === undefined ? coreStyles.triBtnNa : ''}`}
                        aria-pressed={item.passed === undefined}
                        onClick={() => updateChecklistItem(idx, { passed: undefined })}
                        disabled={createMutation.isPending}
                        data-testid={`checklist-na-${idx}`}
                      >
                        {S.dialog.notChecked}
                      </button>
                    </div>
                  </div>
                  <Input
                    aria-label={S.dialog.noteLabel(item.label)}
                    maxLength={200}
                    value={item.note ?? ''}
                    onChange={(e) => updateChecklistItem(idx, { note: e.target.value.slice(0, 200) })}
                    placeholder={S.dialog.notePlaceholder}
                    disabled={createMutation.isPending}
                    data-testid={`checklist-note-${idx}`}
                  />
                </div>
              ))}
            </div>
            {verdictGuard ? (
              <p className={styles.guard} role="status" data-testid="inspection-verdict-guard">
                {S.dialog.guard}
              </p>
            ) : null}
          </fieldset>

          <Field label={S.dialog.findings} error={fieldErrors.findings}>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder={S.dialog.findingsPlaceholder}
              disabled={createMutation.isPending}
              data-testid="inspection-findings-input"
            />
          </Field>

          <Field label={S.dialog.recommendation} error={fieldErrors.recommendation}>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder={S.dialog.recommendationPlaceholder}
              disabled={createMutation.isPending}
              data-testid="inspection-recommendation-input"
            />
          </Field>
        </form>
      </Dialog>

      {/* Read-only inspection detail */}
      <Dialog
        open={Boolean(selectedInspection)}
        onClose={() => setSelectedInspection(null)}
        title={S.detail.title(selectedInspection?.batchCode ?? '')}
        description={S.detail.description}
        actions={
          <Button variant="secondary" onClick={() => setSelectedInspection(null)}>
            {S.detail.close}
          </Button>
        }
      >
        {selectedInspection ? (
          <div className={coreStyles.pageStack} data-testid="inspection-readonly-detail">
            <div className={coreStyles.detailGrid}>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.verdict}</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.status ? <StatusBadge status={selectedInspection.status as StatusBadgeValue} /> : EMPTY_VALUE}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.rating}</span>
                <span className={coreStyles.metaValue}>{S.rating(selectedInspection.rating)}</span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.inspector}</span>
                <span className={coreStyles.metaValue}>
                  {selectedInspection.inspectedBy?.name ?? selectedInspection.inspectedBy?.username ?? EMPTY_VALUE}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.recorded}</span>
                <span className={coreStyles.metaValue}>{formatTimestamp(selectedInspection.createdAt)}</span>
              </div>
            </div>

            {selectedInspection.findings ? (
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.findings}</span>
                <span className={coreStyles.metaValue}>{selectedInspection.findings}</span>
              </div>
            ) : null}

            {selectedInspection.recommendation ? (
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>{S.detail.recommendation}</span>
                <span className={coreStyles.metaValue}>{selectedInspection.recommendation}</span>
              </div>
            ) : null}

            <div className={styles.checklist}>
              <span className={coreStyles.checklistLabel}>{S.detail.checklist}</span>
              <ul className={styles.resultList}>
                {(selectedInspection.checklist ?? []).map((item, idx) => (
                  <li key={item.label ?? idx} className={styles.resultRow}>
                    <span>{item.label}</span>
                    <strong className={item.passed === false ? styles.resultFail : undefined}>
                      {item.passed === true ? S.dialog.pass : item.passed === false ? S.dialog.fail : S.dialog.notChecked}
                    </strong>
                    {item.note ? <span className={styles.resultNote}>{item.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>

            {selectedInspection.id ? (
              <div className={coreStyles.pageStack} data-testid="inspection-comments-section">
                <span className={coreStyles.checklistLabel}>{S.detail.comments}</span>
                <RecordComments refType="inspection" refId={selectedInspection.id} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
