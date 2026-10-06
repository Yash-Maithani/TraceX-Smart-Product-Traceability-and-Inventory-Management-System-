import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, Copy, Download, Edit3, ExternalLink, FileText, Truck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import {
  archiveBatch,
  fetchBatchDetail,
  fetchBatchInspections,
  fetchBatchQr,
  fetchBatchScans,
  updateBatchNote,
  updateBatchRawMaterial
} from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import {
  canArchiveBatch,
  canDispatchBatch,
  canEditBatchNote,
  canEditRawMaterial,
  canViewBatchInspections
} from '../../auth/permissions.generated';
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
  type StatusBadgeValue
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { DispatchDialog } from './DispatchDialog';

const UNIT_OPTIONS = ['Kg', 'Units', 'Liters'] as const;

export function BatchDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rawMaterialOpen, setRawMaterialOpen] = useState(false);
  const [dispatchWarning, setDispatchWarning] = useState<string | null>(null);

  const [noteInput, setNoteInput] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  // Raw-material correction form state
  const [farmerName, setFarmerName] = useState('');
  const [village, setVillage] = useState('');
  const [sourceLotCode, setSourceLotCode] = useState('');
  const [quantityProduced, setQuantityProduced] = useState('');
  const [unit, setUnit] = useState('Kg');
  const [yieldPercent, setYieldPercent] = useState('');
  const [packDate, setPackDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [rawReason, setRawReason] = useState('');
  const [rawServerError, setRawServerError] = useState<string | null>(null);
  const [rawFieldErrors, setRawFieldErrors] = useState<Record<string, string>>({});

  const batchQuery = useQuery({
    queryKey: ['batch', id],
    queryFn: () => fetchBatchDetail(id),
    enabled: Boolean(id)
  });

  const allowBatchInspections = canViewBatchInspections(user);
  const inspectionsQuery = useQuery({
    queryKey: ['inspections', 'batch', id],
    queryFn: () => fetchBatchInspections(id),
    enabled: Boolean(id) && allowBatchInspections
  });

  const qrQuery = useQuery({
    queryKey: ['batch', id, 'qr'],
    queryFn: () => fetchBatchQr(id),
    enabled: Boolean(id)
  });

  const scansQuery = useQuery({
    queryKey: ['batch', id, 'scans'],
    queryFn: () => fetchBatchScans(id),
    enabled: Boolean(id)
  });

  const batch = batchQuery.data;

  const handleDownloadQr = () => {
    if (!qrQuery.data?.qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrQuery.data.qrCodeDataUrl;
    a.download = `${batch?.batchCode ?? 'batch'}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyQrUrl = async () => {
    if (!qrQuery.data?.qrAbsoluteUrl) return;
    try {
      await navigator.clipboard.writeText(qrQuery.data.qrAbsoluteUrl);
      pushToast({
        title: 'URL copied',
        description: 'Public trace URL copied to clipboard.',
        variant: 'success'
      });
    } catch {
      // Fallback if clipboard API not permitted
    }
  };

  useEffect(() => {
    if (batch) {
      setNoteInput(batch.traceabilityNote ?? '');
      setFarmerName(batch.farmerName ?? '');
      setVillage(batch.village ?? '');
      setSourceLotCode(batch.sourceLotCode ?? '');
      setQuantityProduced(String(batch.quantityProduced ?? ''));
      setUnit(batch.unit ?? 'Kg');
      setYieldPercent(String(batch.yieldPercent ?? ''));
      setPackDate(batch.packDate ?? '');
      setExpiryDate(batch.expiryDate ?? '');
    }
  }, [batch]);

  const noteMutation = useMutation({
    mutationFn: async () => updateBatchNote(id, { note: noteInput.trim() }),
    onSuccess: async () => {
      setNoteError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batch', id] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] })
      ]);
      pushToast({
        title: 'Traceability note updated',
        description: 'The updated note has been saved and appended to noteHistory.',
        variant: 'success'
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fieldMsg = err.fieldErrors.find((fe) => fe.field === 'note')?.message;
        setNoteError(fieldMsg ?? err.message);
      } else {
        setNoteError(err instanceof Error ? err.message : 'Unable to update note.');
      }
    }
  });

  const rawMaterialMutation = useMutation({
    mutationFn: async () => {
      const qty = Number.parseInt(quantityProduced, 10);
      const yld = Number.parseFloat(yieldPercent);
      return updateBatchRawMaterial(id, {
        farmerName: farmerName.trim(),
        village: village.trim(),
        sourceLotCode: sourceLotCode.trim(),
        quantityProduced: Number.isNaN(qty) ? 0 : qty,
        unit: unit.trim(),
        yieldPercent: Number.isNaN(yld) ? 0 : yld,
        ...(expiryDate.trim() ? { expiryDate: expiryDate.trim() } : {})
      });
    },
    onSuccess: async () => {
      setRawServerError(null);
      setRawFieldErrors({});
      setRawReason('');
      setRawMaterialOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batch', id] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      ]);
      pushToast({
        title: 'Raw-material fields corrected',
        description: 'Provenance and shelf-life fields have been updated.',
        variant: 'success'
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setRawServerError(err.message);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          mapped[fe.field] = fe.message;
        }
        setRawFieldErrors(mapped);
      } else {
        setRawServerError(err instanceof Error ? err.message : 'Unable to update raw-material fields.');
      }
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const note = reason?.trim() ?? 'Archived by administrator';
      return archiveBatch(id, { reason: note, deleteNote: note });
    },
    onSuccess: async () => {
      setArchiveOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batch', id] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['batches', 'archived'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      ]);
      pushToast({
        title: 'Batch archived',
        description: `${batch?.batchCode ?? 'Batch'} moved to Archived Batches.`,
        variant: 'success'
      });
      navigate('/batches/archived');
    },
    onError: (err) => {
      pushToast({
        title: 'Archive failed',
        description: err instanceof Error ? err.message : 'Unable to archive batch.',
        variant: 'error'
      });
    }
  });

  const handleNoteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (noteMutation.isPending) return;
    if (!noteInput.trim()) {
      setNoteError('Traceability note cannot be empty.');
      return;
    }
    setNoteError(null);
    noteMutation.mutate();
  };

  const handleRawMaterialSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (rawMaterialMutation.isPending) return;
    setRawServerError(null);
    setRawFieldErrors({});
    rawMaterialMutation.mutate();
  };

  return (
    <div className={coreStyles.pageStack} data-testid="batch-detail-page">
      <PageHeader
        title={batch?.batchCode ? `Batch ${batch.batchCode}` : 'Batch Details'}
        subtitle={
          batch
            ? `${batch.productName ?? ''} (${batch.sku ?? ''})`
            : 'Provenance, freshness status, quality checks, and dispatch history'
        }
        breadcrumbs={[
          { label: 'Batches', href: '/batches' },
          { label: batch?.batchCode ?? id }
        ]}
        backdropKey="batches"
        priority
        actions={
          <div className={coreStyles.inlineRow}>
            <Link to="/batches">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={15} />}>
                Back to Batches
              </Button>
            </Link>
            {batch && canEditRawMaterial(user) && !batch.deleted ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Edit3 size={15} />}
                onClick={() => setRawMaterialOpen(true)}
                data-testid="open-raw-material-btn"
              >
                Correct Raw Material
              </Button>
            ) : null}
            {batch &&
            canDispatchBatch(user) &&
            batch.lifecycleState !== 'DISPATCHED' &&
            !batch.deleted ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Truck size={15} />}
                onClick={() => setDispatchOpen(true)}
                data-testid="open-dispatch-dialog-btn"
              >
                Dispatch Batch
              </Button>
            ) : null}
            {batch && canArchiveBatch(user) && !batch.deleted ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Archive size={15} />}
                onClick={() => setArchiveOpen(true)}
                data-testid="open-archive-dialog-btn"
              >
                Archive
              </Button>
            ) : null}
          </div>
        }
      />

      {batchQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label="Loading batch details" />
        </div>
      ) : batchQuery.isError || !batch ? (
        <ErrorState
          title="Unable to load batch details"
          description={
            batchQuery.error instanceof Error
              ? batchQuery.error.message
              : 'The requested batch could not be loaded.'
          }
          requestId={
            batchQuery.error instanceof ApiError ? batchQuery.error.requestId : undefined
          }
          onRetry={() => void batchQuery.refetch()}
        />
      ) : (
        <>
          {dispatchWarning || batch.warning ? (
            <div
              className={`${coreStyles.alertBanner} ${coreStyles.alertWarning}`}
              role="status"
              data-testid="batch-dispatch-warning"
            >
              <strong>Dispatch Quality Advisory:</strong> {dispatchWarning ?? batch.warning}
            </div>
          ) : null}

          {batch.status === 'EXCEPTION' ? (
            <div
              className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
              role="alert"
              data-testid="batch-exception-banner"
            >
              <strong>Freshness Data Exception:</strong>{' '}
              {batch.exceptionReason ?? 'Missing or unparseable expiry date.'}
            </div>
          ) : null}

          <section className={coreStyles.sectionCard} data-testid="batch-overview-section">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>Provenance & Freshness Summary</h2>
                <p className={coreStyles.sectionSubtitle}>
                  Server-computed freshness status and raw-material origin metadata
                </p>
              </div>
              <div className={coreStyles.inlineRow}>
                {batch.status ? <StatusBadge status={batch.status} /> : null}
                {batch.qualityCheck?.status ? (
                  <StatusBadge status={batch.qualityCheck.status as StatusBadgeValue} />
                ) : null}
              </div>
            </div>

            <div className={coreStyles.detailGrid}>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Batch Code</span>
                <span className={coreStyles.monoCode} data-testid="detail-batch-code">
                  {batch.batchCode}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Product & SKU</span>
                <span className={coreStyles.metaValue}>
                  {batch.productName} ({batch.sku})
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Pack Date</span>
                <span className={coreStyles.metaValue} data-testid="detail-pack-date">
                  {formatBusinessDate(batch.packDate)}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Expiry Date</span>
                <span className={coreStyles.metaValue} data-testid="detail-expiry-date">
                  {formatBusinessDate(batch.expiryDate)}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Days Until Expiry</span>
                <span className={coreStyles.metaValue} data-testid="detail-days-until-expiry">
                  {batch.status === 'EXCEPTION'
                    ? '— (Exception)'
                    : `${batch.daysUntilExpiry ?? '—'} days`}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Quantity & Yield</span>
                <span className={coreStyles.metaValue} data-testid="detail-quantity">
                  {batch.quantityProduced} {batch.unit} ({batch.yieldPercent}% yield)
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Source Lot Code</span>
                <span className={coreStyles.monoCode} data-testid="detail-lot-code">
                  {batch.sourceLotCode}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Farmer & Village</span>
                <span className={coreStyles.metaValue} data-testid="detail-farmer-village">
                  {batch.farmerName} — {batch.village}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Lifecycle State</span>
                <span className={coreStyles.metaValue}>{batch.lifecycleState}</span>
              </div>
              {batch.buyerName ? (
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>Dispatched To</span>
                  <span className={coreStyles.metaValue} data-testid="detail-buyer-name">
                    {batch.buyerName} ({formatBusinessDate(batch.dispatchDate)})
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <div className={coreStyles.twoColumnGrid}>
            <section className={coreStyles.sectionCard} data-testid="batch-quality-snapshot">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Latest Quality Check Snapshot</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Embedded verdict snapshot on the batch document
                  </p>
                </div>
                {batch.qualityCheck?.status ? (
                  <StatusBadge status={batch.qualityCheck.status as StatusBadgeValue} />
                ) : null}
              </div>

              {batch.qualityCheck ? (
                <div className={coreStyles.detailGrid}>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Verdict</span>
                    <span className={coreStyles.metaValue}>{batch.qualityCheck.status}</span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Rating</span>
                    <span className={coreStyles.metaValue}>
                      {batch.qualityCheck.rating} / 5
                    </span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Inspector</span>
                    <span className={coreStyles.metaValue}>
                      {batch.qualityCheck.inspectorName}
                    </span>
                  </div>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Inspected At</span>
                    <span className={coreStyles.metaValue}>
                      {formatTimestamp(batch.qualityCheck.inspectedAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No quality check recorded yet"
                  description="This batch has not been inspected by a quality inspector."
                />
              )}
            </section>

            <section className={coreStyles.sectionCard} data-testid="batch-note-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Traceability Note & History</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Current note: <strong>{batch.traceabilityNote || 'None'}</strong>
                  </p>
                </div>
                <FileText size={18} aria-hidden="true" />
              </div>

              {canEditBatchNote(user) && !batch.deleted ? (
                <form onSubmit={handleNoteSubmit} className={coreStyles.pageStack} noValidate>
                  <Field
                    label="Add / Update Traceability Note"
                    error={noteError ?? undefined}
                  >
                    <Textarea
                      value={noteInput}
                      onChange={(e) => {
                        setNoteInput(e.target.value);
                        if (noteError) setNoteError(null);
                      }}
                      placeholder="Enter updated traceability note…"
                      disabled={noteMutation.isPending}
                      data-testid="batch-note-input"
                    />
                  </Field>
                  <div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      isLoading={noteMutation.isPending}
                      disabled={noteMutation.isPending}
                      data-testid="save-batch-note-btn"
                    >
                      Save Note
                    </Button>
                  </div>
                </form>
              ) : null}

              {batch.noteHistory && batch.noteHistory.length > 0 ? (
                <ul className={coreStyles.timelineList} data-testid="batch-note-history">
                  {batch.noteHistory.map((entry, idx) => (
                    <li key={`${entry.editedAt ?? idx}-${idx}`} className={coreStyles.timelineItem}>
                      <div className={coreStyles.timelineHeader}>
                        <strong>{entry.editedBy}</strong>
                        <span>{formatTimestamp(entry.editedAt)}</span>
                      </div>
                      <div>{entry.note}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={coreStyles.sectionSubtitle}>No note edits recorded yet.</p>
              )}
            </section>
          </div>

          <div className={coreStyles.twoColumnGrid}>
            <section className={coreStyles.sectionCard} data-testid="batch-qr-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Batch QR Code</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Cryptographic public traceability link and scannable packaging QR code
                  </p>
                </div>
              </div>

              {qrQuery.isPending ? (
                <Skeleton label="Loading QR code" />
              ) : qrQuery.isError ? (
                <ErrorState
                  title="Unable to load QR code"
                  description={
                    qrQuery.error instanceof Error
                      ? qrQuery.error.message
                      : 'Failed to load batch QR code.'
                  }
                  onRetry={() => void qrQuery.refetch()}
                />
              ) : qrQuery.data ? (
                <div className={coreStyles.qrContainer}>
                  <img
                    src={qrQuery.data.qrCodeDataUrl}
                    alt={`QR code for batch ${batch.batchCode ?? ''}`}
                    className={coreStyles.qrImage}
                    data-testid="batch-qr-image"
                  />
                  <div className={coreStyles.qrUrlBox} data-testid="qr-absolute-url">
                    {qrQuery.data.qrAbsoluteUrl}
                  </div>
                  <div className={coreStyles.filterActionGroup}>
                    <Button
                      variant="secondary"
                      onClick={handleCopyQrUrl}
                      data-testid="copy-qr-url-btn"
                    >
                      <Copy className={coreStyles.buttonIcon} /> Copy Link
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleDownloadQr}
                      data-testid="download-qr-btn"
                    >
                      <Download className={coreStyles.buttonIcon} /> Download PNG
                    </Button>
                    <a
                      href={qrQuery.data.qrAbsoluteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="open-public-trace-link"
                    >
                      <Button variant="secondary">
                        <ExternalLink className={coreStyles.buttonIcon} /> Open Public Page
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No QR code available"
                  description="Could not retrieve a QR code for this batch."
                />
              )}
            </section>

            <section className={coreStyles.sectionCard} data-testid="batch-scans-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Scan Activity</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Consumer and logistics scan counts, timestamps, and device analytics
                  </p>
                </div>
              </div>

              {scansQuery.isPending ? (
                <Skeleton label="Loading scan activity" />
              ) : scansQuery.isError ? (
                <ErrorState
                  title="Unable to load scan activity"
                  description={
                    scansQuery.error instanceof Error
                      ? scansQuery.error.message
                      : 'Failed to load scan activity.'
                  }
                  onRetry={() => void scansQuery.refetch()}
                />
              ) : !scansQuery.data || scansQuery.data.total === 0 ? (
                <div data-testid="scans-empty-state">
                  <EmptyState
                    title="No scans recorded yet"
                    description="This QR code has not been scanned by any buyers or consumers yet."
                  />
                </div>
              ) : (
                <div className={coreStyles.scansContainer} data-testid="scans-data-container">
                  <div className={coreStyles.scansOverview}>
                    <div>
                      <span className={coreStyles.metaLabel}>Total Scans: </span>
                      <strong className={coreStyles.metricValue} data-testid="scans-total">
                        {scansQuery.data.total}
                      </strong>
                    </div>
                    <div>
                      <span className={coreStyles.metaLabel}>Last Scanned: </span>
                      <span data-testid="scans-last-scanned">
                        {scansQuery.data.lastScannedAt
                          ? formatTimestamp(scansQuery.data.lastScannedAt)
                          : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className={coreStyles.scansBreakdownGrid}>
                    <div className={coreStyles.breakdownCard} data-testid="scans-device-breakdown">
                      <div className={coreStyles.breakdownTitle}>By Device</div>
                      <ul className={coreStyles.breakdownList}>
                        <li className={coreStyles.breakdownItem}>
                          <span>Mobile</span>
                          <strong data-testid="scans-device-mobile">
                            {scansQuery.data.byDevice?.Mobile ?? 0}
                          </strong>
                        </li>
                        <li className={coreStyles.breakdownItem}>
                          <span>Tablet</span>
                          <strong data-testid="scans-device-tablet">
                            {scansQuery.data.byDevice?.Tablet ?? 0}
                          </strong>
                        </li>
                        <li className={coreStyles.breakdownItem}>
                          <span>Desktop</span>
                          <strong data-testid="scans-device-desktop">
                            {scansQuery.data.byDevice?.Desktop ?? 0}
                          </strong>
                        </li>
                        <li className={coreStyles.breakdownItem}>
                          <span>Unknown</span>
                          <strong data-testid="scans-device-unknown">
                            {scansQuery.data.byDevice?.Unknown ?? 0}
                          </strong>
                        </li>
                      </ul>
                    </div>

                    <div className={coreStyles.breakdownCard} data-testid="scans-source-breakdown">
                      <div className={coreStyles.breakdownTitle}>By Source</div>
                      <ul className={coreStyles.breakdownList}>
                        <li className={coreStyles.breakdownItem}>
                          <span>Buyer</span>
                          <strong data-testid="scans-source-buyer">
                            {scansQuery.data.bySource?.buyer ?? 0}
                          </strong>
                        </li>
                        <li className={coreStyles.breakdownItem}>
                          <span>Factory</span>
                          <strong data-testid="scans-source-factory">
                            {scansQuery.data.bySource?.factory ?? 0}
                          </strong>
                        </li>
                        <li className={coreStyles.breakdownItem}>
                          <span>QA</span>
                          <strong data-testid="scans-source-qa">
                            {scansQuery.data.bySource?.QA ?? 0}
                          </strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className={coreStyles.twoColumnGrid}>
            <section className={coreStyles.sectionCard} data-testid="batch-dispatch-history-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Dispatch History</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Audit trail of dispatch events and FEFO override justifications
                  </p>
                </div>
              </div>

              {batch.dispatchHistory && batch.dispatchHistory.length > 0 ? (
                <ul className={coreStyles.timelineList} data-testid="batch-dispatch-history-list">
                  {batch.dispatchHistory.map((d, idx) => (
                    <li key={`${d.dispatchedAt ?? idx}-${idx}`} className={coreStyles.timelineItem}>
                      <div className={coreStyles.timelineHeader}>
                        <strong>Buyer: {d.buyerName}</strong>
                        <span>Dispatch Date: {formatBusinessDate(d.dispatchDate)}</span>
                      </div>
                      <div className={coreStyles.timelineHeader}>
                        <span>Dispatched by: {d.dispatchedBy}</span>
                        <span>Recorded: {formatTimestamp(d.dispatchedAt)}</span>
                      </div>
                      {d.outOfOrder ? (
                        <div className={coreStyles.metaValue}>
                          <strong>FEFO Override Reason:</strong> {d.overrideReason}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Not yet dispatched"
                  description="No dispatch events have been recorded for this batch."
                />
              )}
            </section>

            <section className={coreStyles.sectionCard} data-testid="batch-inspections-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>Inspection Records</h2>
                  <p className={coreStyles.sectionSubtitle}>
                    Append-only 8-point quality inspection records for this batch
                  </p>
                </div>
              </div>

              {!allowBatchInspections ? (
                <p className={coreStyles.sectionSubtitle} data-testid="inspections-role-restricted-msg">
                  Detailed inspection checklists are restricted for your role. Refer to the Latest
                  Quality Check Snapshot above before dispatching.
                </p>
              ) : inspectionsQuery.isPending ? (
                <Skeleton label="Loading batch inspections" />
              ) : inspectionsQuery.isError ? (
                <ErrorState
                  title="Unable to load batch inspections"
                  description={
                    inspectionsQuery.error instanceof Error
                      ? inspectionsQuery.error.message
                      : 'Failed to load inspections.'
                  }
                  onRetry={() => void inspectionsQuery.refetch()}
                />
              ) : !inspectionsQuery.data || inspectionsQuery.data.length === 0 ? (
                <EmptyState
                  title="No inspections for this batch"
                  description="Quality inspectors can record an 8-point inspection from the Quality Inspections page."
                />
              ) : (
                <ul className={coreStyles.timelineList} data-testid="batch-inspections-list">
                  {inspectionsQuery.data.map((insp) => (
                    <li key={insp.id} className={coreStyles.timelineItem}>
                      <div className={coreStyles.itemCardHeader}>
                        <div className={coreStyles.inlineRow}>
                          {insp.status ? (
                            <StatusBadge status={insp.status as StatusBadgeValue} />
                          ) : null}
                          <span>Rating: {insp.rating}/5</span>
                          {insp.isLatest ? (
                            <span className={coreStyles.metaLabel}>(Latest)</span>
                          ) : null}
                        </div>
                        <span className={coreStyles.metaLabel}>
                          {formatTimestamp(insp.createdAt)}
                        </span>
                      </div>
                      <div className={coreStyles.metaLabel}>
                        Inspector: {insp.inspectedBy?.name ?? insp.inspectedBy?.username ?? '—'}
                      </div>
                      {insp.findings ? (
                        <div>
                          <strong>Findings:</strong> {insp.findings}
                        </div>
                      ) : null}
                      {insp.recommendation ? (
                        <div>
                          <strong>Recommendation:</strong> {insp.recommendation}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <DispatchDialog
            open={dispatchOpen}
            onClose={() => setDispatchOpen(false)}
            batch={batch}
            onSuccess={(_updated, warning) => {
              if (warning) {
                setDispatchWarning(warning);
              }
            }}
          />

          <ConfirmDialog
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
            title={`Archive Batch ${batch.batchCode ?? ''}`}
            description="Archiving soft-deletes this batch from active views and the FEFO queue. Administrators can restore it from Archived Batches."
            confirmLabel="Archive Batch"
            variant="danger"
            requireReason
            reasonLabel="Archive Reason"
            isLoading={archiveMutation.isPending}
            onConfirm={(reason) => archiveMutation.mutate(reason)}
          />

          <Dialog
            open={rawMaterialOpen}
            onClose={() => {
              if (!rawMaterialMutation.isPending) setRawMaterialOpen(false);
            }}
            title={`Correct Raw Material — ${batch.batchCode ?? ''}`}
            description="Update provenance or date fields with an audited correction reason."
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() => setRawMaterialOpen(false)}
                  disabled={rawMaterialMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  form="raw-material-form"
                  isLoading={rawMaterialMutation.isPending}
                  disabled={rawMaterialMutation.isPending}
                  data-testid="save-raw-material-btn"
                >
                  Save Correction
                </Button>
              </>
            }
          >
            <form
              id="raw-material-form"
              onSubmit={handleRawMaterialSubmit}
              className={coreStyles.pageStack}
              noValidate
            >
              {rawServerError ? (
                <div
                  className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
                  role="alert"
                  data-testid="raw-material-error"
                >
                  {rawServerError}
                </div>
              ) : null}

              <div className={coreStyles.twoColumnGrid}>
                <Field label="Farmer Name" required error={rawFieldErrors.farmerName}>
                  <Input
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-farmer-name"
                  />
                </Field>

                <Field label="Village" required error={rawFieldErrors.village}>
                  <Input
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-village"
                  />
                </Field>
              </div>

              <div className={coreStyles.threeColumnGrid}>
                <Field label="Source Lot Code" required error={rawFieldErrors.sourceLotCode}>
                  <Input
                    value={sourceLotCode}
                    onChange={(e) => setSourceLotCode(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-lot-code"
                  />
                </Field>

                <Field label="Quantity Produced" required error={rawFieldErrors.quantityProduced}>
                  <Input
                    type="number"
                    min={1}
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-quantity"
                  />
                </Field>

                <Field label="Unit" required error={rawFieldErrors.unit}>
                  <Select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-unit"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className={coreStyles.threeColumnGrid}>
                <Field label="Yield (%)" required error={rawFieldErrors.yieldPercent}>
                  <Input
                    type="number"
                    step="0.1"
                    min={0.1}
                    max={100}
                    value={yieldPercent}
                    onChange={(e) => setYieldPercent(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-yield"
                  />
                </Field>

                <Field label="Pack Date" required error={rawFieldErrors.packDate}>
                  <Input
                    type="date"
                    value={packDate}
                    onChange={(e) => setPackDate(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-pack-date"
                  />
                </Field>

                <Field label="Expiry Date" required error={rawFieldErrors.expiryDate}>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-expiry-date"
                  />
                </Field>
              </div>

              <Field
                label="Correction Reason"
                required
                hint="Required for audit trail."
                error={rawFieldErrors.reason}
              >
                <Textarea
                  value={rawReason}
                  onChange={(e) => setRawReason(e.target.value)}
                  placeholder="Describe why raw-material fields are being corrected…"
                  disabled={rawMaterialMutation.isPending}
                  data-testid="raw-reason"
                />
              </Field>
            </form>
          </Dialog>
        </>
      )}
    </div>
  );
}
