import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
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
  if (status === 'done') {
    return <span className={`${styles.verdictTag} ${styles.verdictInsert}`}>Done</span>;
  }
  if (status === 'running') {
    return <span className={`${styles.verdictTag} ${styles.verdictSkip}`}>Running</span>;
  }
  if (status === 'rolled_back') {
    return <span className={styles.verdictTag}>Rolled Back</span>;
  }
  return <span className={`${styles.verdictTag} ${styles.verdictError}`}>Failed</span>;
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
        title: 'Import rolled back',
        description: `Archived ${res.archived ?? 0} imported batch(es).`,
        variant: 'success'
      });
    },
    onError: (err) => {
      setRollbackTargetJob(null);
      pushToast({
        title: 'Rollback blocked',
        description:
          err instanceof Error ? err.message : 'Unable to roll back this import job.',
        variant: 'error'
      });
    }
  });

  const schemaColumns: ImportColumnDto[] = schemaQuery.data?.columns ?? FALLBACK_SCHEMA_COLUMNS;

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
      setErrorBanner('Unable to read the selected file.');
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
        err instanceof Error ? err.message : 'Failed to auto-detect CSV headers.'
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
        err instanceof Error ? err.message : 'Failed to validate CSV rows.'
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
            err instanceof Error ? err.message : 'Chunk commit failed unexpectedly.',
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

  const filteredPreviewRows = previewRows.filter((r) => {
    if (previewFilter === 'all') return true;
    return r.verdict === previewFilter;
  });

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
        title="Bulk CSV Import"
        subtitle="Upload, map, validate, and import batch records in 200-row chunks"
        backdropKey="import"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={15} />}
            onClick={handleDownloadTemplate}
            data-testid="download-template-btn"
          >
            Download CSV Template
          </Button>
        }
      />

      {/* Step Bar */}
      <div className={styles.stepBar} aria-label="Import progress steps">
        {(
          [
            { key: 'upload', label: '1. Upload CSV' },
            { key: 'map', label: '2. Map Columns' },
            { key: 'preview', label: '3. Preview & Validate' },
            { key: 'commit', label: '4. Commit Progress' },
            { key: 'result', label: '5. Result' }
          ] as const
        ).map((item, idx) => {
          const order = ['upload', 'map', 'preview', 'commit', 'result'] as const;
          const activeIdx = order.indexOf(step);
          const isCurrent = step === item.key;
          const isDone = idx < activeIdx;
          return (
            <span
              key={item.key}
              className={`${styles.stepItem} ${
                isCurrent ? styles.stepItemActive : isDone ? styles.stepItemDone : ''
              }`}
              data-testid={`import-step-${item.key}`}
            >
              {isDone ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
              <span>{item.label}</span>
            </span>
          );
        })}
      </div>

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
              <h2 className={coreStyles.sectionTitle}>Select a UTF-8 CSV File</h2>
              <p className={coreStyles.sectionSubtitle}>
                Supports comma, semicolon, and tab delimiters up to{' '}
                {MAX_IMPORT_ROWS.toLocaleString()} rows per job (chunked at {CHUNK_SIZE} rows per
                request). Excel (.xls / .xlsx) files are not accepted (D-5).
              </p>
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
              {isBusy
                ? 'Reading and analyzing CSV headers…'
                : 'Click to select a .csv file or drag and drop here'}
            </p>
            <p className={styles.dropzoneHint}>
              Required columns: Product SKU (or Product Name), Source Lot Code, Farmer Name,
              Village, Quantity Produced, Unit, Yield %, and Pack Date.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className={styles.hiddenFileInput}
              onChange={handleFileInputChange}
              aria-label="Upload CSV file"
              data-testid="import-file-input"
            />
          </div>

          <div>
            <div className={coreStyles.metaLabel}>Supported Schema Columns</div>
            <div className={styles.schemaChips}>
              {schemaColumns.map((col) => (
                <span
                  key={col.key}
                  className={`${styles.schemaChip} ${
                    col.required ? styles.schemaChipRequired : ''
                  }`}
                >
                  {col.label} ({col.key}){col.required ? ' *' : ''}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* STEP 2: MAP COLUMNS */}
      {step === 'map' ? (
        <section className={coreStyles.sectionCard} data-testid="import-map-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>Map CSV Headers to TraceX Fields</h2>
              <p className={coreStyles.sectionSubtitle}>
                File: <strong>{fileName}</strong> • {rows.length.toLocaleString()} data row(s) •{' '}
                {headers.length} column(s)
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              onClick={resetWizard}
              data-testid="import-reset-btn"
            >
              Choose Different File
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
                Map all required fields before validating. Missing required field(s):{' '}
                <strong>{unmappedRequired.join(', ')}</strong>
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
                        {col.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <div className={styles.mappingColHint}>{col.hint}</div>
                  </div>

                  <div>
                    <label>
                      <span className="sr-only">CSV column for {col.label}</span>
                      <select
                        aria-label={`Map ${col.label}`}
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
                        <option value="">— Ignore —</option>
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
                        ? `Sample: ${sampleValues}`
                        : 'Sample: (empty in first 2 rows)'
                      : `e.g. ${col.example ?? ''}`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={resetWizard}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={isBusy}
              disabled={unmappedRequired.length > 0 || isBusy}
              onClick={() => void handleValidate()}
              data-testid="import-validate-btn"
            >
              Validate {rows.length.toLocaleString()} Row{rows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </section>
      ) : null}

      {/* STEP 3: PREVIEW & VALIDATE */}
      {step === 'preview' && validateSummary ? (
        <section className={coreStyles.sectionCard} data-testid="import-preview-section">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>Validation Preview</h2>
              <p className={coreStyles.sectionSubtitle}>
                Review row verdicts before committing. Personal supplier data (Farmer Name) is
                redacted from preview and logs per D-9.
              </p>
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
                  Download Error Report ({previewRowErrors.length})
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
                onClick={() => setStep('map')}
                data-testid="back-to-map-btn"
              >
                Adjust Mapping
              </Button>
            </div>
          </div>

          <div className={coreStyles.metricsGrid} data-testid="preview-summary-metrics">
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Total Rows</div>
              <div className={coreStyles.metricValue} data-testid="summary-total-count">
                {validateSummary.total}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Will Import</div>
              <div className={coreStyles.metricValue} data-testid="summary-insert-count">
                {validateSummary.insert}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Duplicates (Skipped)</div>
              <div className={coreStyles.metricValue} data-testid="summary-skip-count">
                {validateSummary.skip}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Rows With Errors</div>
              <div className={coreStyles.metricValue} data-testid="summary-error-count">
                {validateSummary.error}
              </div>
            </div>
          </div>

          <div className={styles.filterTabs} role="group" aria-label="Filter preview rows">
            {(
              [
                { key: 'all', label: `All (${validateSummary.total})` },
                { key: 'insert', label: `Will Import (${validateSummary.insert})` },
                { key: 'skip', label: `Duplicates (${validateSummary.skip})` },
                { key: 'error', label: `Errors (${validateSummary.error})` }
              ] as const
            ).map((tab) => (
              <Button
                key={tab.key}
                variant={previewFilter === tab.key ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPreviewFilter(tab.key)}
                data-testid={`preview-filter-${tab.key}`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.dataTable} data-testid="import-preview-table">
              <thead>
                <tr>
                  <th>Row #</th>
                  <th>Verdict</th>
                  <th>Source Lot Code</th>
                  <th>Product SKU</th>
                  <th>Pack Date</th>
                  <th>Village</th>
                  <th>Qty</th>
                  <th>Details / Validation Messages</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreviewRows.map((pRow, idx) => (
                  <tr
                    key={pRow.rowNumber ?? idx}
                    data-testid={`preview-row-${pRow.rowNumber ?? idx}`}
                  >
                    <td className={coreStyles.monoCode}>{pRow.rowNumber ?? '—'}</td>
                    <td>
                      {pRow.verdict === 'insert' ? (
                        <span className={`${styles.verdictTag} ${styles.verdictInsert}`}>
                          Will Import
                        </span>
                      ) : pRow.verdict === 'skip' ? (
                        <span className={`${styles.verdictTag} ${styles.verdictSkip}`}>
                          Duplicate (Skip)
                        </span>
                      ) : (
                        <span className={`${styles.verdictTag} ${styles.verdictError}`}>
                          Error
                        </span>
                      )}
                    </td>
                    <td className={coreStyles.monoCode}>
                      {pRow.sourceLotCode ?? '—'}
                    </td>
                    <td>
                      <div className={coreStyles.monoCode}>
                        {pRow.product?.sku ?? '—'}
                      </div>
                      {pRow.product?.productName ? (
                        <div className={coreStyles.metaLabel}>
                          {pRow.product.productName}
                        </div>
                      ) : null}
                    </td>
                    <td>{pRow.packDate ?? '—'}</td>
                    <td>{pRow.village ?? '—'}</td>
                    <td>
                      {pRow.quantityProduced !== null && pRow.quantityProduced !== undefined
                        ? `${pRow.quantityProduced} ${pRow.unit ?? ''}`
                        : '—'}
                    </td>
                    <td>
                      {pRow.verdict === 'skip' ? (
                        <span>{pRow.reason ?? 'Duplicate row'}</span>
                      ) : pRow.errors && pRow.errors.length > 0 ? (
                        <div>
                          {pRow.errors.map((err, eIdx) => (
                            <div key={`${err.field}-${eIdx}`}>
                              <strong>{err.field}:</strong> {err.message}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>Ready to import</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={resetWizard}>
              Start Over
            </Button>
            <Button
              variant="primary"
              disabled={validateSummary.insert <= 0 || isBusy}
              onClick={() => void handleCommit()}
              data-testid="import-commit-btn"
            >
              Import {validateSummary.insert} Batch{validateSummary.insert === 1 ? '' : 'es'}
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
                {commitFailure ? 'Import Stopped Due to Chunk Error' : 'Importing Batches…'}
              </h2>
              <p className={coreStyles.sectionSubtitle}>
                Chunk {commitProgress.completedChunks} of {commitProgress.totalChunks} completed (
                {progressPct}%)
                {commitProgress.jobId ? ` • Job #${commitProgress.jobId}` : ''}
              </p>
            </div>
          </div>

          <progress
            className={styles.progressBar}
            value={progressPct}
            max={100}
            aria-label="Import chunk progress"
            data-testid="import-progress-bar"
          />

          {isBusy ? (
            <div>
              <Spinner size="md" label="Committing 200-row chunk…" />
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
                  <strong>
                    Chunk {commitFailure.failedChunk} of {commitFailure.totalChunks} failed:
                  </strong>{' '}
                  {commitFailure.message}
                </div>
                {commitFailure.jobId ? (
                  <div data-testid="failed-chunk-job-id">
                    Import Job ID: <span className={coreStyles.monoCode}>{commitFailure.jobId}</span>
                  </div>
                ) : null}
                <div>
                  Import stopped immediately (no automatic retry).{' '}
                  {commitFailure.jobId
                    ? `Job #${commitFailure.jobId} was left in "running" status and will automatically transition to "failed" after the 15-minute stale window, at which point an authorized user can roll back the partial import from Recent Imports below.`
                    : 'No batches were committed before this failure.'}
                </div>
                <div className={styles.actionGroup}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetWizard}
                    data-testid="failure-start-over-btn"
                  >
                    Start Over
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
              <h2 className={coreStyles.sectionTitle}>Import Complete</h2>
              <p className={coreStyles.sectionSubtitle}>
                File: <strong>{fileName}</strong> • Job ID:{' '}
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
                  Download Error Report ({resultRowErrors.length})
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FileSpreadsheet size={15} />}
                onClick={resetWizard}
                data-testid="import-another-btn"
              >
                Import Another File
              </Button>
            </div>
          </div>

          <div className={coreStyles.metricsGrid} data-testid="import-result-metrics">
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Batches Inserted</div>
              <div className={coreStyles.metricValue} data-testid="result-inserted-count">
                {completedCommit.totals?.inserted ?? completedCommit.chunkInserted ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Duplicates Skipped</div>
              <div className={coreStyles.metricValue} data-testid="result-skipped-count">
                {completedCommit.totals?.skipped ?? completedCommit.chunkSkipped ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Row Errors</div>
              <div className={coreStyles.metricValue} data-testid="result-errored-count">
                {completedCommit.totals?.errored ?? completedCommit.chunkErrored ?? 0}
              </div>
            </div>
            <div className={coreStyles.metricCard}>
              <div className={coreStyles.metricLabelRow}>Total Rows Processed</div>
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
                    <th>Row #</th>
                    <th>Source Lot Code</th>
                    <th>Field</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRowErrors.map((err, idx) => (
                    <tr key={`${err.rowNumber}-${err.field}-${idx}`}>
                      <td className={coreStyles.monoCode}>{err.rowNumber ?? '—'}</td>
                      <td className={coreStyles.monoCode}>{err.sourceLotCode ?? '—'}</td>
                      <td className={coreStyles.monoCode}>{err.field}</td>
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
            <h2 className={coreStyles.sectionTitle}>Recent Import Jobs</h2>
            <p className={coreStyles.sectionSubtitle}>
              Audit history of bulk CSV imports. Completed or failed imports with inserted batches
              can be rolled back if none of their batches have been dispatched.
            </p>
          </div>
        </div>

        {historyQuery.isLoading ? (
          <Spinner size="md" label="Loading import history…" />
        ) : historyJobs.length === 0 ? (
          <EmptyState
            title="No import jobs recorded yet"
            description="Upload a CSV file above to create your first bulk batch import."
          />
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable} data-testid="recent-imports-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Status</th>
                  <th>Inserted</th>
                  <th>Skipped</th>
                  <th>Errored</th>
                  <th>Total</th>
                  <th>Actor / Started</th>
                  <th>Actions</th>
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
                        <div className={coreStyles.metaLabel}>{jobId}</div>
                      </td>
                      <td data-testid={`import-job-status-${jobId}`}>
                        {renderJobStatusTag(job.status)}
                      </td>
                      <td className={coreStyles.monoCode}>{job.inserted ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.skipped ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.errored ?? 0}</td>
                      <td className={coreStyles.monoCode}>{job.totalRows ?? 0}</td>
                      <td>
                        <div>{job.createdBy}</div>
                        <div className={coreStyles.metaLabel}>
                          {formatTimestamp(job.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Eye size={14} />}
                            onClick={() => setDetailDialogJobId(jobId)}
                            data-testid={`view-job-detail-${jobId}`}
                          >
                            Details
                          </Button>
                          {allowRollback ? (
                            <Button
                              variant="danger"
                              size="sm"
                              leftIcon={<RotateCcw size={14} />}
                              disabled={!canRollbackThisJob || rollbackMutation.isPending}
                              onClick={() => setRollbackTargetJob(job)}
                              data-testid={`rollback-job-btn-${jobId}`}
                            >
                              Rollback
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
        title="Import Job Details"
        description={
          jobDetailQuery.data
            ? `${jobDetailQuery.data.fileName ?? ''} (${jobDetailQuery.data.id ?? ''})`
            : 'Loading import job details…'
        }
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
                Download Error Report
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setDetailDialogJobId(null)}>
              Close
            </Button>
          </>
        }
      >
        {jobDetailQuery.isLoading ? (
          <Spinner size="md" label="Loading job details…" />
        ) : jobDetailQuery.data ? (
          <div className={coreStyles.pageStack} data-testid="import-job-detail-dialog">
            <div className={coreStyles.metricsGrid}>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>Status</div>
                <div>{renderJobStatusTag(jobDetailQuery.data.status)}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>Inserted</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.inserted ?? 0}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>Skipped</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.skipped ?? 0}</div>
              </div>
              <div className={coreStyles.metricCard}>
                <div className={coreStyles.metricLabelRow}>Errors</div>
                <div className={coreStyles.metricValue}>{jobDetailQuery.data.errored ?? 0}</div>
              </div>
            </div>

            {jobDetailQuery.data.rowErrors && jobDetailQuery.data.rowErrors.length > 0 ? (
              <div className={styles.tableScroll}>
                <table className={styles.dataTable} data-testid="detail-row-errors-table">
                  <thead>
                    <tr>
                      <th>Row #</th>
                      <th>Source Lot Code</th>
                      <th>Field</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobDetailQuery.data.rowErrors.map((err, idx) => (
                      <tr key={`${err.rowNumber}-${err.field}-${idx}`}>
                        <td className={coreStyles.monoCode}>{err.rowNumber ?? '—'}</td>
                        <td className={coreStyles.monoCode}>{err.sourceLotCode ?? '—'}</td>
                        <td className={coreStyles.monoCode}>{err.field}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={coreStyles.sectionSubtitle}>
                No row validation errors were recorded for this import job.
              </p>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ROLLBACK CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={Boolean(rollbackTargetJob)}
        onClose={() => setRollbackTargetJob(null)}
        title="Rollback Import Job"
        description={
          rollbackTargetJob
            ? `This will archive all ${rollbackTargetJob.inserted ?? 0} batch(es) created by "${rollbackTargetJob.fileName ?? ''}" (#${rollbackTargetJob.id ?? ''}) so their lot codes can be re-imported. Rollback will be blocked with 409 Conflict if any batch from this import has already been dispatched.`
            : ''
        }
        confirmLabel="Confirm Rollback"
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
