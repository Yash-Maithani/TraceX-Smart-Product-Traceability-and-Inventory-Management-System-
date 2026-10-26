import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ClipboardCheck,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Lock,
  Package,
  Printer,
  ScanLine,
  Tag,
  Truck
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './batches.module.css';
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
  canViewBatchInspections,
  canViewShopperReports
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
  ShelfLifeRail,
  Skeleton,
  StatusBadge,
  Textarea,
  Timeline,
  type TimelineEntry,
  useToast,
  type StatusBadgeValue
} from '../../components/ui';
import { isOnHold } from '../../components/ui/statusMap';
import { FEFO_STRINGS } from '../../strings/fefo';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { DispatchDialog } from './DispatchDialog';
import { EMPTY_VALUE, formatDays } from '../../lib/format';
import { RecordComments } from '../messages/RecordComments';
import { ShopperReportsSection } from './ShopperReportsSection';
import { DETAIL_STRINGS as D } from '../../strings/batchDetail';
import { STATUS_STRINGS } from '../../strings/status';

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
  const dispatchBlock = !batch
    ? null
    : isOnHold(batch)
      ? FEFO_STRINGS.blocked.onHold
      : batch.status === 'EXPIRED'
        ? FEFO_STRINGS.blocked.expired
        : null;

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
        title: D.qr.copied,
        description: D.qr.copiedBody,
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
        title: D.note.saved,
        description: D.note.savedBody,
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
        title: D.correction.saved,
        description: D.correction.savedBody,
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
        title: D.archiveDialog.done,
        description: D.archiveDialog.doneBody(batch?.batchCode ?? ''),
        variant: 'success'
      });
      navigate('/batches/archived');
    },
    onError: (err) => {
      pushToast({
        title: D.archiveDialog.failed,
        description: err instanceof Error ? err.message : 'Unable to archive batch.',
        variant: 'error'
      });
    }
  });

  // Unsaved-changes guard (DESIGN.md §2.3): warn before the tab closes or reloads while the note
  // or the correction form has edits that are not saved.
  const noteDirty = Boolean(batch) && noteInput.trim() !== (batch?.traceabilityNote ?? '').trim();
  const rawDirty =
    rawMaterialOpen &&
    Boolean(batch) &&
    (farmerName !== (batch?.farmerName ?? '') ||
      village !== (batch?.village ?? '') ||
      sourceLotCode !== (batch?.sourceLotCode ?? '') ||
      quantityProduced !== String(batch?.quantityProduced ?? '') ||
      yieldPercent !== String(batch?.yieldPercent ?? '') ||
      expiryDate !== (batch?.expiryDate ?? '') ||
      rawReason.trim() !== '');
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    if (!noteDirty && !rawDirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [noteDirty, rawDirty]);

  const closeRawMaterial = () => {
    if (rawMaterialMutation.isPending) return;
    if (rawDirty) {
      setDiscardOpen(true);
      return;
    }
    setRawMaterialOpen(false);
  };

  // One story per batch: packed, notes, inspections, dispatches and scans, newest first
  const history = useMemo<TimelineEntry[]>(() => {
    if (!batch) return [];
    const items: (TimelineEntry & { at: string })[] = [];
    if (batch.packDate) {
      items.push({
        id: 'packed',
        at: `${batch.packDate}T00:00:00`,
        icon: <Package size={16} aria-hidden="true" />,
        iconLabel: D.history.packedLabel,
        title: D.history.packed(D.quantity(batch.quantityProduced, batch.unit)),
        time: formatBusinessDate(batch.packDate),
        body: D.history.packedBody(batch.sourceLotCode ?? '', batch.village ?? '')
      });
    }
    (batch.noteHistory ?? []).forEach((n, i) => {
      items.push({
        id: `note-${i}`,
        at: n.editedAt ?? '',
        icon: <FileText size={16} aria-hidden="true" />,
        iconLabel: D.history.noteLabel,
        title: D.history.note(n.editedBy ?? ''),
        time: formatTimestamp(n.editedAt),
        body: n.note,
        condensed: true
      });
    });
    (inspectionsQuery.data ?? []).forEach((insp) => {
      const tone = insp.status === 'PASSED' ? 'success' : insp.status === 'FAILED' ? 'danger' : 'warning';
      items.push({
        id: `insp-${insp.id}`,
        at: insp.createdAt ?? '',
        icon: <ClipboardCheck size={16} aria-hidden="true" />,
        iconLabel: D.history.inspectionLabel(insp.status ?? ''),
        title: D.history.inspection(insp.status ?? '', insp.rating ?? 0),
        time: formatTimestamp(insp.createdAt),
        body: insp.findings ?? undefined,
        tone
      });
    });
    (batch.dispatchHistory ?? []).forEach((d, i) => {
      items.push({
        id: `dispatch-${i}`,
        at: d.dispatchedAt ?? `${d.dispatchDate ?? ''}T00:00:00`,
        icon: <Truck size={16} aria-hidden="true" />,
        iconLabel: D.history.dispatchLabel,
        title: D.history.dispatch(d.buyerName ?? '', d.quantity, batch.unit),
        time: formatBusinessDate(d.dispatchDate),
        body: d.outOfOrder ? D.history.override(d.overrideReason ?? '') : D.history.dispatchedBy(d.dispatchedBy ?? ''),
        tone: d.outOfOrder ? 'warning' : 'info'
      });
    });
    if (scansQuery.data?.lastScannedAt && scansQuery.data.total) {
      items.push({
        id: 'scans',
        at: scansQuery.data.lastScannedAt,
        icon: <ScanLine size={16} aria-hidden="true" />,
        iconLabel: D.history.scanLabel,
        title: D.history.scans(scansQuery.data.total),
        time: formatTimestamp(scansQuery.data.lastScannedAt),
        condensed: true
      });
    }
    return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [batch, inspectionsQuery.data, scansQuery.data]);

  const printSheet = () => window.print();
  const printLabel = () => {
    const root = document.documentElement;
    root.setAttribute('data-print', 'label');
    const clear = () => {
      root.removeAttribute('data-print');
      window.removeEventListener('afterprint', clear);
    };
    window.addEventListener('afterprint', clear);
    window.print();
  };

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
        title={batch?.batchCode ?? D.titleLoading}
        subtitle={batch ? `${batch.productName ?? ''} (${batch.sku ?? ''})` : undefined}
        breadcrumbs={[
          { label: D.breadcrumbBatches, href: '/batches' },
          { label: batch?.batchCode ?? id }
        ]}
        meta={
          batch ? (
            <span className={styles.headerMeta}>
              {batch.status ? <StatusBadge status={batch.status} /> : null}
              {batch.qualityCheck?.status === 'FAILED' ? <StatusBadge status="ON_HOLD" /> : null}
              <ShelfLifeRail
                packDate={batch.packDate}
                expiryDate={batch.expiryDate}
                daysUntilExpiry={batch.daysUntilExpiry}
                status={batch.status}
                testId="detail-shelf-life"
              />
              <span className={styles.qty} data-testid="detail-quantity">
                {(batch.quantityDispatched ?? 0) > 0 && batch.lifecycleState !== 'DISPATCHED'
                  ? D.quantityLeft(batch.quantityRemaining ?? 0, batch.quantityProduced ?? 0, batch.unit)
                  : D.quantity(batch.quantityProduced, batch.unit)}
              </span>
            </span>
          ) : undefined
        }
        backdropKey="batches"
        priority
        actions={
          batch ? (
            <>
              <Button variant="ghost" size="sm" leftIcon={<Printer size={15} />} onClick={printSheet} data-testid="print-batch-btn">
                {D.print}
              </Button>
              {canEditRawMaterial(user) && !batch.deleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Edit3 size={15} />}
                  onClick={() => setRawMaterialOpen(true)}
                  data-testid="open-raw-material-btn"
                >
                  {D.correct}
                </Button>
              ) : null}
              {canArchiveBatch(user) && !batch.deleted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.dangerGhost}
                  leftIcon={<Archive size={15} />}
                  onClick={() => setArchiveOpen(true)}
                  data-testid="open-archive-dialog-btn"
                >
                  {D.archive}
                </Button>
              ) : null}
              {canDispatchBatch(user) && batch.lifecycleState !== 'DISPATCHED' && !batch.deleted ? (
                <span className={styles.dispatchAction}>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={dispatchBlock ? <Lock size={15} /> : <Truck size={15} />}
                    onClick={() => setDispatchOpen(true)}
                    disabled={Boolean(dispatchBlock)}
                    aria-describedby={dispatchBlock ? 'batch-dispatch-block' : undefined}
                    data-testid="open-dispatch-dialog-btn"
                  >
                    {D.dispatch}
                  </Button>
                  {dispatchBlock ? (
                    <span id="batch-dispatch-block" className={styles.dispatchBlock} data-testid="batch-dispatch-block">
                      {dispatchBlock}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : null
        }
      />

      {batchQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label={D.loading} />
        </div>
      ) : batchQuery.isError || !batch ? (
        <ErrorState
          title={D.errorTitle}
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
              <strong>{D.advisory}</strong> {dispatchWarning ?? batch.warning}
            </div>
          ) : null}

          {batch.status === 'EXCEPTION' ? (
            <div
              className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
              role="alert"
              data-testid="batch-exception-banner"
            >
              <strong>{D.exception}</strong> {batch.exceptionReason ?? D.exceptionFallback}
            </div>
          ) : null}

          <div className={styles.detailLayout}>
            <div className={styles.detailMain}>
            <section className={coreStyles.sectionCard} data-testid="batch-timeline-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.history.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.history.subtitle}</p>
                </div>
              </div>
              {history.length === 0 ? (
                <p className={coreStyles.sectionSubtitle}>{D.history.empty}</p>
              ) : (
                <Timeline label={D.history.heading} entries={history} testId="batch-timeline" />
              )}
            </section>

            <section className={coreStyles.sectionCard} data-testid="batch-inspections-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.inspections.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.inspections.subtitle}</p>
                </div>
              </div>

              {!allowBatchInspections ? (
                <p className={coreStyles.sectionSubtitle} data-testid="inspections-role-restricted-msg">
                  {D.inspections.restricted}
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
                  title={D.inspections.emptyTitle}
                  description={D.inspections.emptyBody}
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
                        Inspector: {insp.inspectedBy?.name ?? insp.inspectedBy?.username ?? EMPTY_VALUE}
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

            {batch.id && canViewShopperReports(user) ? <ShopperReportsSection batchId={batch.id} /> : null}

            <section className={coreStyles.sectionCard} data-testid="batch-dispatch-history-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.dispatches.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.dispatches.subtitle}</p>
                </div>
              </div>

              {batch.dispatchHistory && batch.dispatchHistory.length > 0 ? (
                <ul className={coreStyles.timelineList} data-testid="batch-dispatch-history-list">
                  {batch.dispatchHistory.map((d, idx) => (
                    <li key={`${d.dispatchedAt ?? idx}-${idx}`} className={coreStyles.timelineItem}>
                      <div className={coreStyles.timelineHeader}>
                        <strong>
                          Buyer: {d.buyerName}
                          {d.quantity ? ` (${D.quantity(d.quantity, batch.unit)})` : ''}
                        </strong>
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
                  title={D.dispatches.emptyTitle}
                  description={D.dispatches.emptyBody}
                />
              )}
            </section>

            {batch.id ? (
              <section className={coreStyles.sectionCard} data-testid="batch-comments-section">
                <div className={coreStyles.sectionHeader}>
                  <div>
                    <h2 className={coreStyles.sectionTitle}>{D.comments.heading}</h2>
                    <p className={coreStyles.sectionSubtitle}>{D.comments.subtitle}</p>
                  </div>
                </div>
                <RecordComments refType="batch" refId={batch.id} />
              </section>
            ) : null}
            </div>
            <div className={styles.detailSide}>
          <section className={coreStyles.sectionCard} data-testid="batch-overview-section">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>{D.details.heading}</h2>
                <p className={coreStyles.sectionSubtitle}>{D.details.subtitle}</p>
              </div>
            </div>

            <div className={coreStyles.detailGrid}>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Batch code</span>
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
                <span className={coreStyles.metaLabel}>Pack date</span>
                <span className={coreStyles.metaValue} data-testid="detail-pack-date">
                  {formatBusinessDate(batch.packDate)}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Expiry date</span>
                <span className={coreStyles.metaValue} data-testid="detail-expiry-date">
                  {formatBusinessDate(batch.expiryDate)}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Days until expiry</span>
                <span className={coreStyles.metaValue} data-testid="detail-days-until-expiry">
                  {batch.status === 'EXCEPTION'
                    ? 'Exception'
                    : formatDays(batch.daysUntilExpiry, ' days')}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Quantity & Yield</span>
                <span className={coreStyles.metaValue} data-testid="detail-quantity">
                  {batch.quantityProduced} {batch.unit} ({batch.yieldPercent}% yield)
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Source lot code</span>
                <span className={coreStyles.monoCode} data-testid="detail-lot-code">
                  {batch.sourceLotCode}
                </span>
              </div>
              <div className={coreStyles.metaItem}>
                <span className={coreStyles.metaLabel}>Farmer & Village</span>
                <span className={coreStyles.metaValue} data-testid="detail-farmer-village">
                  {batch.farmerName}, {batch.village}
                </span>
              </div>
              {batch.buyerName ? (
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>
                    {batch.lifecycleState === 'DISPATCHED' ? 'Dispatched to' : 'Last shipment to'}
                  </span>
                  <span className={coreStyles.metaValue} data-testid="detail-buyer-name">
                    {batch.buyerName} ({formatBusinessDate(batch.dispatchDate)})
                  </span>
                </div>
              ) : null}
            </div>
          </section>

            <section className={coreStyles.sectionCard} data-testid="batch-quality-snapshot">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.quality.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.quality.subtitle}</p>
                </div>
                {batch.qualityCheck?.status ? (
                  <StatusBadge status={batch.qualityCheck.status as StatusBadgeValue} />
                ) : null}
              </div>

              {batch.qualityCheck ? (
                <div className={coreStyles.detailGrid}>
                  <div className={coreStyles.metaItem}>
                    <span className={coreStyles.metaLabel}>Verdict</span>
                    <span className={coreStyles.metaValue}>
                      {STATUS_STRINGS[batch.qualityCheck.status as keyof typeof STATUS_STRINGS] ?? batch.qualityCheck.status}
                    </span>
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
                    <span className={coreStyles.metaLabel}>Inspected</span>
                    <span className={coreStyles.metaValue}>
                      {formatTimestamp(batch.qualityCheck.inspectedAt)}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title={D.quality.emptyTitle}
                  description={D.quality.emptyBody}
                />
              )}
            </section>

            <section className={coreStyles.sectionCard} data-testid="batch-qr-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.qr.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.qr.subtitle}</p>
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
                    <Button variant="secondary" size="sm" leftIcon={<Copy size={15} />} onClick={handleCopyQrUrl} data-testid="copy-qr-url-btn">
                      {D.qr.copy}
                    </Button>
                    <Button variant="secondary" size="sm" leftIcon={<Download size={15} />} onClick={handleDownloadQr} data-testid="download-qr-btn">
                      {D.qr.download}
                    </Button>
                    <Button variant="secondary" size="sm" leftIcon={<Tag size={15} />} onClick={printLabel} data-testid="print-label-btn">
                      {D.qr.printLabel}
                    </Button>
                    <a
                      href={qrQuery.data.qrAbsoluteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.inlineLink}
                      data-testid="open-public-trace-link"
                    >
                      <ExternalLink size={15} aria-hidden="true" /> {D.qr.open}
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
                  <h2 className={coreStyles.sectionTitle}>{D.scans.heading}</h2>
                  <p className={coreStyles.sectionSubtitle}>{D.scans.subtitle}</p>
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
                    title={D.scans.emptyTitle}
                    description={D.scans.emptyBody}
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
                      <div className={coreStyles.breakdownTitle}>By device</div>
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
                      <div className={coreStyles.breakdownTitle}>By source</div>
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
            <section className={coreStyles.sectionCard} data-testid="batch-note-section">
              <div className={coreStyles.sectionHeader}>
                <div>
                  <h2 className={coreStyles.sectionTitle}>{D.note.heading}</h2>
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
          </div>

          <div className={styles.printLabel} aria-hidden="true">
            {qrQuery.data?.qrCodeDataUrl ? <img src={qrQuery.data.qrCodeDataUrl} alt="" /> : null}
            <div>
              <div className={styles.printLabelCode}>{batch.batchCode}</div>
              <div>{batch.productName}</div>
              <div>{D.bestBefore(formatBusinessDate(batch.expiryDate))}</div>
            </div>
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
            title={D.archiveDialog.title(batch.batchCode ?? '')}
            description={D.archiveDialog.body}
            confirmLabel={D.archiveDialog.confirm}
            cancelLabel={D.archiveDialog.cancel}
            variant="danger"
            requireReason
            reasonLabel={D.archiveDialog.reason}
            isLoading={archiveMutation.isPending}
            onConfirm={(reason) => archiveMutation.mutate(reason)}
          />

          <ConfirmDialog
            open={discardOpen}
            onClose={() => setDiscardOpen(false)}
            title={D.discard.title}
            description={D.discard.body}
            confirmLabel={D.discard.confirm}
            cancelLabel={D.discard.cancel}
            variant="danger"
            onConfirm={() => {
              setDiscardOpen(false);
              setRawMaterialOpen(false);
              if (batch) {
                setFarmerName(batch.farmerName ?? '');
                setVillage(batch.village ?? '');
                setSourceLotCode(batch.sourceLotCode ?? '');
                setQuantityProduced(String(batch.quantityProduced ?? ''));
                setUnit(batch.unit ?? 'Kg');
                setYieldPercent(String(batch.yieldPercent ?? ''));
                setExpiryDate(batch.expiryDate ?? '');
              }
              setRawReason('');
            }}
          />

          <Dialog
            open={rawMaterialOpen}
            onClose={closeRawMaterial}
            title={D.correction.title(batch.batchCode ?? '')}
            description={D.correction.body}
            actions={
              <>
                <Button variant="secondary" onClick={closeRawMaterial} disabled={rawMaterialMutation.isPending}>
                  {D.correction.cancel}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  form="raw-material-form"
                  isLoading={rawMaterialMutation.isPending}
                  disabled={rawMaterialMutation.isPending}
                  data-testid="save-raw-material-btn"
                >
                  {D.correction.save}
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
                <Field label="Farmer name" required error={rawFieldErrors.farmerName}>
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
                <Field label="Source lot code" required error={rawFieldErrors.sourceLotCode}>
                  <Input
                    value={sourceLotCode}
                    onChange={(e) => setSourceLotCode(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-lot-code"
                  />
                </Field>

                <Field label="Quantity produced" required error={rawFieldErrors.quantityProduced}>
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

                <Field label="Pack date" required error={rawFieldErrors.packDate}>
                  <Input
                    type="date"
                    value={packDate}
                    onChange={(e) => setPackDate(e.target.value)}
                    disabled={rawMaterialMutation.isPending}
                    data-testid="raw-pack-date"
                  />
                </Field>

                <Field label="Expiry date" required error={rawFieldErrors.expiryDate}>
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
                label="Reason for the correction"
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
