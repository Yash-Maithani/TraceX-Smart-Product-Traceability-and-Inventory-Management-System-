import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  RotateCcw,
  Upload
} from 'lucide-react';
import coreStyles from '../core/core.module.css';
import styles from './ImportPage.module.css';
import {
  commitImportRows,
  fetchImportHistory,
  fetchImportJobDetail,
  fetchImportSchema,
  mapImportHeaders,
  rollbackImportJob,
  validateImportRows
} from '../../api/endpoints';
import type {
  ImportColumnDto,
  ImportCommitRequestDto,
  ImportCommitResponseDto,
  ImportJobDetailDto,
  ImportJobSummaryDto,
  ImportPreviewRowDto,
  ImportRowErrorDto,
  ImportValidateSummaryDto
} from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canRollbackImport } from '../../auth/permissions.generated';
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  PageHeader,
  Spinner,
  useToast
} from '../../components/ui';
import { formatTimestamp } from '../../lib/dates';
import {
  CHUNK_SIZE,
  MAX_IMPORT_ROWS,
  parseAndValidateCsv,
  toCsv,
  toErrorReportCsv,
  type CsvRowObject
} from './csvParser';
import { EMPTY_VALUE } from '../../lib/format';
import { IMPORT_STRINGS as S } from '../../strings/import';

const VERDICT_ORDER: Record<string, number> = { error: 0, skip: 1, insert: 2 };

export type ImportWizardStep = 'upload' | 'map' | 'preview' | 'commit' | 'result';
type PreviewFilter = 'all' | 'insert' | 'skip' | 'error';

interface CommitFailureState {
  message: string;
  failedChunk: number;
  totalChunks: number;
  jobId: string | null;
}

const FALLBACK_SCHEMA_COLUMNS: ImportColumnDto[] = [
  {
    key: 'productSku',
    label: 'Product SKU',
    required: true,
    type: 'string',
    example: 'WBJC',
    hint: 'Matches Product.sku (preferred) or falls back to Product Name'
  },
  {
    key: 'productName',
    label: 'Product Name',
    required: false,
    type: 'string',
    example: 'Wild Berry Juice Concentrate',
    hint: 'Used only if Product SKU is omitted; must match an active catalogue product'
  },
  {
    key: 'sourceLotCode',
    label: 'Source Lot Code',
    required: true,
    type: 'string',
    example: 'LOT-UK-2026-104',
    hint: 'Raw-material lot identifier from the supplier or farm'
  },
  {
    key: 'farmerName',
    label: 'Farmer Name',
    required: true,
    type: 'string',
    example: 'Kundan Bisht',
    hint: 'Primary producer or supplier name (stored on batch only; never shown in preview)'
  },
  {
    key: 'village',
    label: 'Village',
    required: true,
    type: 'string',
    example: 'Almora',
    hint: 'Source village or collection centre'
  },
  {
    key: 'quantityProduced',
    label: 'Quantity Produced',
    required: true,
    type: 'number',
    example: '120',
    hint: 'Whole or decimal quantity >= 1'
  },
  {
    key: 'unit',
    label: 'Unit',
    required: true,
    type: 'enum',
    example: 'Kg',
    hint: 'One of Kg, Units, Liters (common aliases like kgs, pcs, ltr are normalised)',
    enumValues: ['Kg', 'Units', 'Liters']
  },
  {
    key: 'yieldPercent',
    label: 'Yield %',
    required: true,
    type: 'number',
    example: '86',
    hint: 'Processing yield percentage between 0 and 100'
  },
  {
    key: 'packDate',
    label: 'Pack Date',
    required: true,
    type: 'date',
    example: '2026-10-01',
    hint: 'ISO (YYYY-MM-DD) or DD/MM/YYYY'
  }
];

function triggerCsvDownload(filename: string, csvText: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url =
    typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function renderJobStatusTag(status?: string) {
  const label = S.history.status[status ?? 'failed'] ?? S.history.status.failed;
  if (status === 'done') {
    return <span className={`${styles.verdictTag} ${styles.verdictInsert}`}>{label}</span>;
  }
  if (status === 'running') {
    return <span className={`${styles.verdictTag} ${styles.verdictSkip}`}>{label}</span>;
  }
  if (status === 'rolled_back') {
    return <span className={styles.verdictTag}>{label}</span>;
  }
  return <span className={`${styles.verdictTag} ${styles.verdictError}`}>{label}</span>;
}

function mapRawChunkToCanonical(
  chunk: CsvRowObject[],
  mapping: Record<string, string | null>
): Array<Record<string, unknown>> {
  return chunk.map((rawRow) => {
    const mapped: Record<string, unknown> = {};
    for (const [colKey, csvHeader] of Object.entries(mapping)) {
      if (csvHeader) {
        mapped[colKey] = rawRow[csvHeader] ?? '';
      }
    }
    return mapped;
  });
}

export function ImportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ImportWizardStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRowObject[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  const [isBusy, setIsBusy] = useState(false);
  const [validateSummary, setValidateSummary] = useState<Required<ImportValidateSummaryDto> | null>(
    null
  );
  const [previewRows, setPreviewRows] = useState<ImportPreviewRowDto[]>([]);
  const [previewRowErrors, setPreviewRowErrors] = useState<ImportRowErrorDto[]>([]);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');

  const [commitProgress, setCommitProgress] = useState<{
    completedChunks: number;
    totalChunks: number;
    jobId: string | null;
  }>({ completedChunks: 0, totalChunks: 0, jobId: null });
  const [commitFailure, setCommitFailure] = useState<CommitFailureState | null>(null);
  const [completedCommit, setCompletedCommit] = useState<ImportCommitResponseDto | null>(null);
  const [completedJobDetail, setCompletedJobDetail] = useState<ImportJobDetailDto | null>(null);

  const [detailDialogJobId, setDetailDialogJobId] = useState<string | null>(null);
  const [rollbackTargetJob, setRollbackTargetJob] = useState<ImportJobSummaryDto | null>(null);

  const allowRollback = canRollbackImport(user);

  const schemaQuery = useQuery({
    queryKey: ['import', 'schema'],
    queryFn: fetchImportSchema
  });

  const historyQuery = useQuery({
    queryKey: ['import', 'history'],
    queryFn: fetchImportHistory
  });

  const jobDetailQuery = useQuery({
    queryKey: ['import', 'job', detailDialogJobId],
    queryFn: () => fetchImportJobDetail(detailDialogJobId!),
    enabled: Boolean(detailDialogJobId)
  });

  const rollbackMutation = useMutation({
    mutationFn: (jobId: string) => rollbackImportJob(jobId),
    onSuccess: async (res) => {
      setRollbackTargetJob(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['import', 'history'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['batches', 'archived'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] })
      ]);
      pushToast({
        title: S.rollback.doneTitle,
        description: S.rollback.doneBody(res.archived ?? 0),
        variant: 'success'
      });
    },
    onError: (err) => {
      setRollbackTargetJob(null);
      pushToast({
        title: S.rollback.blockedTitle,
        description: err instanceof Error ? err.message : S.rollback.blockedBody,
        variant: 'error'
      });
    }
  });

  const schemaColumns: ImportColumnDto[] = schemaQuery.data?.columns ?? FALLBACK_SCHEMA_COLUMNS;
  // Readers see column names, never field ids such as productSku
  const fieldLabel = (field: string | undefined) =>
    schemaColumns.find((c) => c.key === field)?.label ?? field ?? '';
  const columnHint = (col: ImportColumnDto) => S.hints[col.key ?? ''] ?? col.hint ?? '';

  // Leave guard (RD-2): matched columns and checked rows are lost on reload or tab close
  const hasUnsavedWork = step === 'map' || step === 'preview' || (step === 'commit' && isBusy);
  useEffect(() => {
    if (!hasUnsavedWork) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = S.leaveWarning;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);

  const unmappedRequired = schemaColumns
    .filter((col) => {
      if (!col.required || !col.key) return false;
      if (col.key === 'productSku' && mapping['productName']) {
        return false;
      }
      return !mapping[col.key];
    })
    .map((col) => col.key ?? '');

  const handleDownloadTemplate = () => {
    const cols = schemaColumns.map((c) => c.key ?? '').filter(Boolean);
    const sampleRow: Record<string, unknown> = {};
    for (const col of schemaColumns) {
      if (col.key) {
        sampleRow[col.key] = col.example ?? '';
      }
    }
    const csv = toCsv(cols, [sampleRow], { neutraliseFormulas: false });
    triggerCsvDownload('TraceX-batch-import-template.csv', csv);
  };

  const handleDownloadErrorReport = (
    errors: ImportRowErrorDto[],
    sourceFileName = fileName || 'import'
  ) => {
    const base = sourceFileName.replace(/\.csv$/i, '') || 'import';
    const normalisedErrors = errors.map((e) => ({
      rowNumber: e.rowNumber ?? null,
      sourceLotCode: e.sourceLotCode ?? null,
      field: e.field ?? '',
      message: e.message ?? ''
    }));
    const csv = toErrorReportCsv(normalisedErrors);
    triggerCsvDownload(`${base}-errors.csv`, csv);
  };

  const resetWizard = () => {
    setStep('upload');
    setErrorBanner(null);
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setValidateSummary(null);
    setPreviewRows([]);
    setPreviewRowErrors([]);
    setPreviewFilter('all');
    setCommitProgress({ completedChunks: 0, totalChunks: 0, jobId: null });
    setCommitFailure(null);
    setCompletedCommit(null);
    setCompletedJobDetail(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processSelectedFile = async (file: File) => {
    setErrorBanner(null);
    setCommitFailure(null);

    let text = '';
    try {
      text = await file.text();
    } catch {
      setErrorBanner(S.errors.readFile);
      return;
    }

    const parsed = parseAndValidateCsv(text, file.name);
    if (!parsed.ok) {
      setErrorBanner(parsed.error);
      return;
    }

    setIsBusy(true);
    try {
      const mapRes = await mapImportHeaders({ headers: parsed.data.headers });
      setFileName(file.name);
      setHeaders(parsed.data.headers);
      setRows(parsed.data.rows);
      setMapping(mapRes.mapping ?? {});
      setStep('map');
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : S.errors.headers
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleValidate = async () => {
    if (unmappedRequired.length > 0 || rows.length === 0) return;
    setErrorBanner(null);
    setIsBusy(true);

    try {
      const chunks: CsvRowObject[][] = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        chunks.push(rows.slice(i, i + CHUNK_SIZE));
      }

      const accumulatedPriorKeys: string[] = [];
      const allPreview: ImportPreviewRowDto[] = [];
      const allRowErrors: ImportRowErrorDto[] = [];
      const aggSummary: Required<ImportValidateSummaryDto> = {
        total: 0,
        insert: 0,
        skip: 0,
        error: 0
      };

      for (let c = 0; c < chunks.length; c += 1) {
        const chunk = chunks[c]!;
        const rowOffset = Number(chunk[0]?.__sheetRow ?? c * CHUNK_SIZE + 2);
        const canonicalRows = mapRawChunkToCanonical(chunk, mapping);

        const res = await validateImportRows({
          rows: canonicalRows,
          rowOffset,
          priorKeys: [...accumulatedPriorKeys]
        });

        aggSummary.total += res.summary?.total ?? 0;
        aggSummary.insert += res.summary?.insert ?? 0;
        aggSummary.skip += res.summary?.skip ?? 0;
        aggSummary.error += res.summary?.error ?? 0;

        for (const pRow of res.preview ?? []) {
          allPreview.push(pRow);
          if (pRow.verdict === 'insert' && pRow.insertKey) {
            accumulatedPriorKeys.push(pRow.insertKey);
          }
          if (pRow.verdict === 'error' && pRow.errors) {
            for (const err of pRow.errors) {
              allRowErrors.push({
                rowNumber: pRow.rowNumber ?? 0,
                sourceLotCode: pRow.sourceLotCode ?? '',
                field: err.field ?? '',
                message: err.message ?? ''
              });
            }
          }
        }
      }

      setValidateSummary(aggSummary);
      setPreviewRows(allPreview);
      setPreviewRowErrors(allRowErrors);
      setPreviewFilter('all');
      setStep('preview');
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : S.errors.validate
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!validateSummary || validateSummary.insert <= 0 || rows.length === 0) return;

    const chunks: CsvRowObject[][] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + CHUNK_SIZE));
    }

    setStep('commit');
    setErrorBanner(null);
    setCommitFailure(null);
    setCommitProgress({
      completedChunks: 0,
      totalChunks: chunks.length,
      jobId: null
    });
    setIsBusy(true);

    let currentJobId: string | null = null;
    let lastResponse: ImportCommitResponseDto | null = null;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      const isFinal = i === chunks.length - 1;
      const rowOffset = Number(chunk[0]?.__sheetRow ?? i * CHUNK_SIZE + 2);
      const canonicalRows = mapRawChunkToCanonical(chunk, mapping);

      const payload: ImportCommitRequestDto = {
        ...(currentJobId ? { jobId: currentJobId } : {}),
        fileName: fileName || 'import.csv',
        rows: canonicalRows,
        rowOffset,
        totalRows: rows.length,
        isFinal
      };

      try {
        const res = await commitImportRows(payload);
        if (res.jobId) {
          currentJobId = res.jobId;
        }
        lastResponse = res;
        setCommitProgress({
          completedChunks: i + 1,
          totalChunks: chunks.length,
          jobId: currentJobId
        });
      } catch (err) {
        setIsBusy(false);
        setCommitFailure({
          message:
            err instanceof Error ? err.message : S.errors.commit,
          failedChunk: i + 1,
          totalChunks: chunks.length,
          jobId: currentJobId
        });
        await queryClient.invalidateQueries({ queryKey: ['import', 'history'] });
        return;
      }
    }

    let detail: ImportJobDetailDto | null = null;
    if (currentJobId) {
      try {
        detail = await fetchImportJobDetail(currentJobId);
      } catch {
        // Detail is optional on the result card if summary succeeded
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['import', 'history'] }),
      queryClient.invalidateQueries({ queryKey: ['batches'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
      queryClient.invalidateQueries({ queryKey: ['fefo'] })
    ]);

    setCompletedCommit(lastResponse);
    setCompletedJobDetail(detail);
    setIsBusy(false);
    setStep('result');
  };

  // Error rows first, then duplicates, then rows to import; file order inside each group
  const filteredPreviewRows = useMemo(
    () =>
      previewRows
        .filter((r) => previewFilter === 'all' || r.verdict === previewFilter)
        .map((r, i) => ({ r, i }))
        .sort((a, b) => (VERDICT_ORDER[a.r.verdict ?? ''] ?? 3) - (VERDICT_ORDER[b.r.verdict ?? ''] ?? 3) || a.i - b.i)
        .map(({ r }) => r),
    [previewRows, previewFilter]
  );

  const progressPct =
    commitProgress.totalChunks > 0
      ? Math.round((commitProgress.completedChunks / commitProgress.totalChunks) * 100)
      : 0;

  const historyJobs: ImportJobSummaryDto[] = historyQuery.data ?? [];
  const resultRowErrors: ImportRowErrorDto[] =
    completedJobDetail?.rowErrors ?? completedCommit?.errors ?? [];

  return (
    <div className={coreStyles.pageStack} data-testid="import-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        backdropKey="import"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={15} />}
            onClick={handleDownloadTemplate}
            data-testid="download-template-btn"
          >
            {S.template}
          </Button>
        }
      />

      {/* Steps: done, current, upcoming */}
      <ol className={styles.stepBar} aria-label={S.stepsLabel}>
        {(['upload', 'map', 'preview', 'commit', 'result'] as const).map((key, idx, order) => {
          const activeIdx = order.indexOf(step);
          const isCurrent = step === key;
          const isDone = idx < activeIdx;
          return (
            <li
              key={key}
              className={`${styles.stepItem} ${isCurrent ? styles.stepItemActive : isDone ? styles.stepItemDone : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              data-testid={`import-step-${key}`}
            >
              <span className={styles.stepNumber} aria-hidden="true">
                {isDone ? <CheckCircle2 size={14} /> : idx + 1}
              </span>
              <span>{S.steps[key]}</span>
              <span className="sr-only">
                , {isDone ? S.stepState.done : isCurrent ? S.stepState.current : S.stepState.upcoming}
              </span>
            </li>
          );
        })}
      </ol>

      {errorBanner ? (
        <div
          className={`${styles.alertBox} ${styles.alertDanger}`}
          role="alert"
          data-testid="import-error-banner"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <div>{errorBanner}</div>
        </div>
      ) : null}

      {/* STEP 1: UPLOAD */}
      {step === 'upload' ? (
        <section className={coreStyles.sectionCard} data-testid="import-upload-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>{S.upload.title}</h2>
              <p className={coreStyles.sectionSubtitle}>{S.upload.body(MAX_IMPORT_ROWS)}</p>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            data-testid="import-dropzone"
          >
            <Upload size={28} aria-hidden="true" />
            <p className={styles.dropzoneTitle}>
              {isBusy ? S.upload.reading : S.upload.drop}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className={styles.hiddenFileInput}
              onChange={handleFileInputChange}
              aria-label={S.upload.fileLabel}
              data-testid="import-file-input"
            />
          </div>

          <div>
            <h3 className={coreStyles.metaLabel}>{S.upload.columnsTitle}</h3>
            <ul className={styles.schemaChips}>
              {schemaColumns.map((col) => (
                <li key={col.key} className={`${styles.schemaChip} ${col.required ? styles.schemaChipRequired : ''}`}>
                  {col.label}
                  {col.required ? <span className={styles.requiredTag}>{S.upload.required}</span> : null}
                </li>
              ))}
            </ul>
            <details className={styles.columnIds}>
              <summary>{S.upload.columnIdsSummary}</summary>
              <p className={coreStyles.sectionSubtitle}>{S.upload.columnIdsNote}</p>
              <code className={styles.columnIdList}>{schemaColumns.map((c) => c.key).filter(Boolean).join(',')}</code>
            </details>
          </div>
        </section>
      ) : null}

      {/* STEP 2: MAP COLUMNS */}
      {step === 'map' ? (
        <section className={coreStyles.sectionCard} data-testid="import-map-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>{S.map.title}</h2>
              <p className={coreStyles.sectionSubtitle}>{S.map.fileLine(fileName, rows.length, headers.length)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={resetWizard}
              data-testid="import-reset-btn"
            >
              {S.map.chooseOther}
            </Button>
          </div>

          {unmappedRequired.length > 0 ? (
            <div
              className={`${styles.alertBox} ${styles.alertWarning}`}
              role="alert"
              data-testid="unmapped-required-warning"
            >
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                {S.map.missing} <strong>{unmappedRequired.map(fieldLabel).join(', ')}</strong>
              </div>
            </div>
          ) : null}

          <div className={styles.mappingList}>
            {schemaColumns.map((col) => {
              const colKey = col.key ?? '';
              const selectedHeader = mapping[colKey] ?? '';
              const sampleValues = selectedHeader
                ? rows
                    .slice(0, 2)
                    .map((r) => String(r[selectedHeader] ?? ''))
                    .filter(Boolean)
                    .join(' | ')
                : '';

              return (
                <div
                  key={colKey}
                  className={styles.mappingRow}
                  data-testid={`mapping-row-${colKey}`}
                >
                  <div className={styles.mappingColMeta}>
                    <div className={styles.mappingColTitle}>
                      <span>{col.label}</span>
                      <span className={coreStyles.metaLabel}>
                        {col.required ? S.map.requiredTag : S.map.optionalTag}
                      </span>
                    </div>
                    <div className={styles.mappingColHint}>{columnHint(col)}</div>
                  </div>

                  <div>
                    <label>
                      <span className="sr-only">{S.map.columnFor(col.label ?? '')}</span>
                      <select
                        aria-label={S.map.columnFor(col.label ?? '')}
                        className={styles.selectInput}
                        value={selectedHeader}
                        onChange={(e) => {
                          const nextVal = e.target.value || null;
                          setMapping((prev) => ({
                            ...prev,
                            [colKey]: nextVal
                          }));
                        }}
                        data-testid={`map-select-${colKey}`}
                      >
                        <option value="">{S.map.ignore}</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={styles.mappingSample}>
                    {selectedHeader
                      ? sampleValues
                        ? S.map.sample(sampleValues)
                        : S.map.sampleEmpty
                      : S.map.example(col.example ?? '')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={resetWizard}>
              {S.map.cancel}
            </Button>
            <Button
              variant="primary"
              isLoading={isBusy}
              disabled={unmappedRequired.length > 0 || isBusy}
              onClick={() => void handleValidate()}
              data-testid="import-validate-btn"
            >
              {S.map.check(rows.length)}
            </Button>
          </div>
        </section>
      ) : null}

      {/* STEP 3: PREVIEW & VALIDATE */}
      {step === 'preview' && validateSummary ? (
        <section className={coreStyles.sectionCard} data-testid="import-preview-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>{S.preview.title}</h2>
              <p className={coreStyles.sectionSubtitle}>{S.preview.body}</p>
            </div>
            <div className={styles.actionGroup}>
              {previewRowErrors.length > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={() => handleDownloadErrorReport(previewRowErrors)}
                  data-testid="download-error-report-btn"
                >
                  {S.preview.errorReport(previewRowErrors.length)}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
                onClick={() => setStep('map')}
                data-testid="back-to-map-btn"
              >
                {S.preview.backToMap}
              </Button>
            </div>
          </div>

          <div className={coreStyles.metricsGrid} data-testid="preview-summary-metrics">
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.preview.totals.total}</div>
              <div className={coreStyles.metricValue} data-testid="summary-total-count">
                {validateSummary.total}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.preview.totals.insert}</div>
              <div className={coreStyles.metricValue} data-testid="summary-insert-count">
                {validateSummary.insert}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.preview.totals.skip}</div>
              <div className={coreStyles.metricValue} data-testid="summary-skip-count">
                {validateSummary.skip}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.preview.totals.error}</div>
              <div className={coreStyles.metricValue} data-testid="summary-error-count">
                {validateSummary.error}
              </div>
            </div>
          </div>

          <div className={styles.filterTabs} role="group" aria-label={S.preview.filterLabel}>
            {(
              [
                { key: 'all', count: validateSummary.total },
                { key: 'error', count: validateSummary.error },
                { key: 'insert', count: validateSummary.insert },
                { key: 'skip', count: validateSummary.skip }
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.filterChip} ${previewFilter === tab.key ? styles.filterChipActive : ''}`}
                aria-pressed={previewFilter === tab.key}
                onClick={() => setPreviewFilter(tab.key)}
                data-testid={`preview-filter-${tab.key}`}
              >
                {S.preview.filters[tab.key]} <span className={styles.filterCount}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.dataTable} data-testid="import-preview-table">
              <caption className="sr-only">{S.preview.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{S.preview.columns.row}</th>
                  <th scope="col">{S.preview.columns.result}</th>
                  <th scope="col">{S.preview.columns.lot}</th>
                  <th scope="col">{S.preview.columns.product}</th>
                  <th scope="col">{S.preview.columns.packDate}</th>
                  <th scope="col">{S.preview.columns.village}</th>
                  <th scope="col">{S.preview.columns.qty}</th>
                  <th scope="col">{S.preview.columns.details}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreviewRows.map((pRow, idx) => (
                  <tr
                    key={pRow.rowNumber ?? idx}
                    data-testid={`preview-row-${pRow.rowNumber ?? idx}`}
                  >
                    <td className={coreStyles.monoCode}>{pRow.rowNumber ?? EMPTY_VALUE}</td>
                    <td>
                      {pRow.verdict === 'insert' ? (
                        <span className={`${styles.verdictTag} ${styles.verdictInsert}`}>
                          {S.preview.verdicts.insert}
                        </span>
                      ) : pRow.verdict === 'skip' ? (
                        <span className={`${styles.verdictTag} ${styles.verdictSkip}`}>
                          {S.preview.verdicts.skip}
                        </span>
                      ) : (
                        <span className={`${styles.verdictTag} ${styles.verdictError}`}>
                          {S.preview.verdicts.error}
                        </span>
                      )}
                    </td>
                    <td className={coreStyles.monoCode}>
                      {pRow.sourceLotCode ?? EMPTY_VALUE}
                    </td>
                    <td>
                      <div className={coreStyles.monoCode}>
                        {pRow.product?.sku ?? EMPTY_VALUE}
                      </div>
                      {pRow.product?.productName ? (
                        <div className={coreStyles.metaLabel}>
                          {pRow.product.productName}
                        </div>
                      ) : null}
                    </td>
                    <td>{pRow.packDate ?? EMPTY_VALUE}</td>
                    <td>{pRow.village ?? EMPTY_VALUE}</td>
                    <td>
                      {pRow.quantityProduced !== null && pRow.quantityProduced !== undefined
                        ? `${pRow.quantityProduced} ${pRow.unit ?? ''}`
                        : EMPTY_VALUE}
                    </td>
                    <td>
                      {pRow.verdict === 'skip' ? (
                        <span>{pRow.reason ?? S.preview.duplicate}</span>
                      ) : pRow.errors && pRow.errors.length > 0 ? (
                        <div>
                          {pRow.errors.map((err, eIdx) => (
                            <div key={`${err.field}-${eIdx}`}>
                              <strong>{fieldLabel(err.field)}:</strong> {err.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>{S.preview.ready}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={resetWizard}>
              {S.preview.startOver}
            </Button>
            <Button
              variant="primary"
              disabled={validateSummary.insert <= 0 || isBusy}
              onClick={() => void handleCommit()}
              data-testid="import-commit-btn"
            >
              {S.preview.importN(validateSummary.insert)}
            </Button>
          </div>
        </section>
      ) : null}

      {/* STEP 4: COMMIT PROGRESS (AND MID-CHUNK FAILURE) */}
      {step === 'commit' ? (
        <section className={coreStyles.sectionCard} data-testid="import-commit-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>
                {commitFailure ? S.commit.titleStopped : S.commit.titleRunning}
              </h2>
              <p className={coreStyles.sectionSubtitle}>
                {S.commit.progress(commitProgress.completedChunks, commitProgress.totalChunks, progressPct)}
              </p>
            </div>
          </div>

          <progress
            className={styles.progressBar}
            value={progressPct}
            max={100}
            aria-label={S.commit.progressLabel}
            data-testid="import-progress-bar"
          />

          {isBusy ? (
            <div>
              <Spinner size="md" label={S.commit.saving} />
            </div>
          ) : null}

          {commitFailure ? (
            <div
              className={`${styles.alertBox} ${styles.alertDanger}`}
              role="alert"
              data-testid="import-commit-failure"
            >
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <div>
                  <strong>{S.commit.failed(commitFailure.failedChunk, commitFailure.totalChunks)}</strong>{' '}
                  {commitFailure.message}
                </div>
                {commitFailure.jobId ? (
                  <div data-testid="failed-chunk-job-id">
                    {S.commit.jobLabel}: <span className={coreStyles.monoCode}>{commitFailure.jobId}</span>
                  </div>
                ) : null}
                <div>
                  {commitFailure.jobId ? S.commit.partialBody : S.commit.noneSaved}
                </div>
                <div className={styles.actionGroup}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetWizard}
                    data-testid="failure-start-over-btn"
                  >
                    {S.commit.startOver}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* STEP 5: RESULT */}
      {step === 'result' && completedCommit ? (
        <section className={coreStyles.sectionCard} data-testid="import-result-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>{S.result.title}</h2>
              <p className={coreStyles.sectionSubtitle}>
                {S.result.fileLine(fileName)}{' '}
                <span className={coreStyles.monoCode} data-testid="result-job-id">
                  {completedCommit.jobId ?? ''}
                </span>
              </p>
            </div>
            <div className={styles.actionGroup}>
              {resultRowErrors.length > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={() => handleDownloadErrorReport(resultRowErrors, fileName)}
                  data-testid="result-download-error-report-btn"
                >
                  {S.result.errorReport(resultRowErrors.length)}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileSpreadsheet size={15} />}
                onClick={resetWizard}
                data-testid="import-another-btn"
              >
                {S.result.another}
              </Button>
            </div>
          </div>

          <div className={coreStyles.metricsGrid} data-testid="import-result-metrics">
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.result.totals.inserted}</div>
              <div className={coreStyles.metricValue} data-testid="result-inserted-count">
                {completedCommit.totals?.inserted ?? completedCommit.chunkInserted ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.result.totals.skipped}</div>
              <div className={coreStyles.metricValue} data-testid="result-skipped-count">
                {completedCommit.totals?.skipped ?? completedCommit.chunkSkipped ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.result.totals.errored}</div>
              <div className={coreStyles.metricValue} data-testid="result-errored-count">
                {completedCommit.totals?.errored ?? completedCommit.chunkErrored ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>{S.result.totals.total}</div>
              <div className={coreStyles.metricValue} data-testid="result-total-count">
                {completedCommit.totals?.totalRows ?? rows.length}
              </div>
            </div>
          </div>

          {resultRowErrors.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.dataTable} data-testid="result-row-errors-table">
                <thead>
                  <tr>
                    <th scope="col">{S.preview.columns.row}</th>
                    <th scope="col">{S.preview.columns.lot}</th>
                    <th scope="col">{S.errorTable.column}</th>
                    <th scope="col">{S.errorTable.problem}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRowErrors.map((err, idx) => (
                    <tr key={`${err.rowNumber}-${err.field}-${idx}`}>
                      <td className={coreStyles.monoCode}>{err.rowNumber ?? EMPTY_VALUE}</td>
                      <td className={coreStyles.monoCode}>{err.sourceLotCode ?? EMPTY_VALUE}</td>
                      <td>{fieldLabel(err.field)}</td>
                      <td>{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* RECENT IMPORTS HISTORY */}
      <section className={coreStyles.sectionCard} data-testid="recent-imports-section">
        <div className={coreStyles.sectionHeader}>
          <div>
            <h2 className={coreStyles.sectionTitle}>{S.history.title}</h2>
            <p className={coreStyles.sectionSubtitle}>{S.history.body}</p>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <Spinner size="md" label={S.history.loading} />
        ) : historyJobs.length === 0 ? (
          <EmptyState
            title={S.history.emptyTitle}
            description={S.history.emptyBody}
          />
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable} data-testid="recent-imports-table">
              <caption className="sr-only">{S.history.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{S.history.columns.file}</th>
                  <th scope="col">{S.history.columns.status}</th>
                  <th scope="col">{S.history.columns.inserted}</th>
                  <th scope="col">{S.history.columns.skipped}</th>
                  <th scope="col">{S.history.columns.errored}</th>
                  <th scope="col">{S.history.columns.total}</th>
                  <th scope="col">{S.history.columns.by}</th>
                  <th scope="col">{S.history.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {historyJobs.map((job) => {
                  const jobId = job.id ?? '';
                  const canRollbackThisJob =
                    allowRollback &&
                    Boolean(jobId) &&
                    (job.status === 'done' || job.status === 'failed') &&
                    (job.inserted ?? 0) > 0;

                  return (
                    <tr key={jobId} data-testid={`import-job-row-${jobId}`}>
                      <td>
                        <div>
                          <strong>{job.fileName}</strong>
                        </div>
                        <div className={coreStyles.metaLabel}>{formatTimestamp(job.createdAt)}</div>
                      </td>
                      <td data-testid={`import-job-status-${jobId}`}>
                        {renderJobStatusTag(job.status)}
                      </td>
                      <td className={coreStyles.monoCode}>{job.inserted ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.skipped ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.errored ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.totalRows ?? 0}</td>
                      <td>{job.createdBy}</td>
                      <td>
                        <div className={styles.actionGroup}>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Eye size={14} />}
                            onClick={() => setDetailDialogJobId(jobId)}
                            aria-label={S.history.detailsLabel(job.fileName ?? '')}
                            data-testid={`view-job-detail-${jobId}`}
                          >
                            {S.history.details}
                          </Button>
                          {allowRollback ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<RotateCcw size={14} />}
                              disabled={!canRollbackThisJob || rollbackMutation.isPending}
                              onClick={() => setRollbackTargetJob(job)}
                              aria-label={S.history.undoLabel(job.fileName ?? '')}
                              data-testid={`rollback-job-btn-${jobId}`}
                            >
                              {S.history.undo}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* JOB DETAIL DIALOG */}
      <Dialog
        open={Boolean(detailDialogJobId)}
        onClose={() => setDetailDialogJobId(null)}
        title={S.detail.title}
        description={jobDetailQuery.data ? jobDetailQuery.data.fileName ?? '' : S.detail.loading}
        actions={
          <>
            {jobDetailQuery.data?.rowErrors && jobDetailQuery.data.rowErrors.length > 0 ? (
              <Button
                variant="secondary"
                leftIcon={<Download size={14} />}
                onClick={() =>
                  handleDownloadErrorReport(
                    jobDetailQuery.data?.rowErrors ?? [],
                    jobDetailQuery.data?.fileName
                  )
                }
                data-testid="detail-download-error-report-btn"
              >
                {S.detail.errorReport}
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setDetailDialogJobId(null)}>
              {S.detail.close}
            </Button>
          </>
        }
      >
        {jobDetailQuery.isLoading ? (
          <Spinner size="md" label={S.detail.loading} />
        ) : jobDetailQuery.data ? (
          <div className={coreStyles.pageStack} data-testid="import-job-detail-dialog">
            <div className={coreStyles.metricsGrid}>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>{S.detail.totals.status}</div>
                <div>{renderJobStatusTag(jobDetailQuery.data.status)}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>{S.detail.totals.inserted}</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.inserted ?? 0}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>{S.detail.totals.skipped}</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.skipped ?? 0}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>{S.detail.totals.errored}</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.errored ?? 0}</div>
              </div>
            </div>

            {jobDetailQuery.data.rowErrors && jobDetailQuery.data.rowErrors.length > 0 ? (
              <div className={styles.tableScroll}>
                <table className={styles.dataTable} data-testid="detail-row-errors-table">
                  <thead>
                    <tr>
                      <th scope="col">{S.preview.columns.row}</th>
                      <th scope="col">{S.preview.columns.lot}</th>
                      <th scope="col">{S.errorTable.column}</th>
                      <th scope="col">{S.errorTable.problem}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobDetailQuery.data.rowErrors.map((err, idx) => (
                      <tr key={`${err.rowNumber}-${err.field}-${idx}`}>
                        <td className={coreStyles.monoCode}>{err.rowNumber ?? EMPTY_VALUE}</td>
                        <td className={coreStyles.monoCode}>{err.sourceLotCode ?? EMPTY_VALUE}</td>
                        <td>{fieldLabel(err.field)}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={coreStyles.sectionSubtitle}>
                {S.detail.noErrors}
              </p>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ROLLBACK CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={Boolean(rollbackTargetJob)}
        onClose={() => setRollbackTargetJob(null)}
        title={
          rollbackTargetJob
            ? S.rollback.title(rollbackTargetJob.fileName ?? '', rollbackTargetJob.createdAt ? formatTimestamp(rollbackTargetJob.createdAt) : '')
            : ''
        }
        description={rollbackTargetJob ? S.rollback.body(rollbackTargetJob.inserted ?? 0) : ''}
        confirmLabel={S.rollback.confirm}
        cancelLabel={S.rollback.cancel}
        variant="danger"
        isLoading={rollbackMutation.isPending}
        onConfirm={() => {
          if (rollbackTargetJob?.id) {
            rollbackMutation.mutate(rollbackTargetJob.id);
          }
        }}
      />
    </div>
  );
}
