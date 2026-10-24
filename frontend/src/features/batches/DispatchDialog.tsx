import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { dispatchBatch } from '../../api/endpoints';
import type { BatchDetailDto, BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canDispatchBatch } from '../../auth/permissions.generated';
import { Button, Dialog, Field, Input, Textarea, isOnHold, useToast } from '../../components/ui';
import { formatBusinessDate } from '../../lib/dates';
import { EMPTY_VALUE } from '../../lib/format';
import { FEFO_STRINGS } from '../../strings/fefo';
import { RAIL_STRINGS, STATUS_STRINGS } from '../../strings/status';

const S = FEFO_STRINGS.dialog;

export interface DispatchDialogProps {
  open: boolean;
  onClose: () => void;
  batch: BatchSummaryDto | BatchDetailDto | null;
  onSuccess?: (updated: BatchDetailDto, warning?: string) => void;
}

export function DispatchDialog({
  open,
  onClose,
  batch,
  onSuccess
}: DispatchDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [buyerName, setBuyerName] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [requiresOverride, setRequiresOverride] = useState(false);
  const [earlierBatchCode, setEarlierBatchCode] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setBuyerName('');
      setDispatchDate('');
      setOverrideReason('');
      setRequiresOverride(false);
      setEarlierBatchCode(null);
      setServerError(null);
      setErrorCode(null);
      setFieldErrors({});
    }
  }, [open, batch?.id]);

  const canOverride = canDispatchBatch(user);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!batch?.id) {
        throw new Error('Missing batch identifier.');
      }
      return dispatchBatch(batch.id, {
        buyerName: buyerName.trim(),
        ...(dispatchDate.trim() ? { dispatchDate: dispatchDate.trim() } : {}),
        ...(requiresOverride && overrideReason.trim()
          ? { overrideReason: overrideReason.trim() }
          : {})
      });
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        batch?.id
          ? queryClient.invalidateQueries({ queryKey: ['batch', batch.id] })
          : Promise.resolve()
      ]);

      const warningMsg = res.data.warning;
      if (warningMsg) {
        pushToast({
          title: S.warningTitle,
          description: warningMsg,
          variant: 'warning'
        });
      } else {
        pushToast({
          title: S.successTitle,
          description: S.successBody(res.data.batchCode ?? batch?.batchCode ?? '', res.data.buyerName ?? buyerName.trim()),
          variant: 'success'
        });
      }

      if (onSuccess) {
        onSuccess(res.data, warningMsg);
      }
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setServerError(err.message);
        setErrorCode(err.code);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          mapped[fe.field] = fe.message;
        }
        setFieldErrors(mapped);

        if (err.code === 'DISPATCH_OUT_OF_ORDER') {
          setRequiresOverride(true);
          const matches = err.message.match(/TX-\d{4}-\d{2}-\d{3,4}/g) ?? [];
          const earlier =
            matches.find((code) => code !== batch?.batchCode) ??
            matches[matches.length - 1] ??
            null;
          setEarlierBatchCode(earlier);
        }

        if (err.code === 'CONFLICT' || err.code === 'ALREADY_DISPATCHED') {
          void queryClient.invalidateQueries({ queryKey: ['batches'] });
          void queryClient.invalidateQueries({ queryKey: ['fefo'] });
          if (batch?.id) {
            void queryClient.invalidateQueries({ queryKey: ['batch', batch.id] });
          }
        }
      } else {
        setServerError(err instanceof Error ? err.message : 'Unable to dispatch batch.');
        setErrorCode('INTERNAL_ERROR');
      }
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mutation.isPending) return;

    const nextFieldErrors: Record<string, string> = {};
    if (!buyerName.trim()) {
      nextFieldErrors.buyerName = S.buyerRequired;
    }
    if (requiresOverride && !overrideReason.trim()) {
      nextFieldErrors.overrideReason = S.overrideRequired;
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setServerError(null);
    mutation.mutate();
  };

  if (!batch) return null;

  // Blocked before any request: the server would refuse these anyway (QUALITY_HOLD, BATCH_EXPIRED)
  const blockedCode = isOnHold(batch) ? 'QUALITY_HOLD' : batch.status === 'EXPIRED' ? 'BATCH_EXPIRED' : null;
  const shownCode = errorCode ?? blockedCode;
  const code = batch.batchCode ?? '';
  const verdict = batch.qualityCheck?.status;
  const quality = verdict
    ? (STATUS_STRINGS as Record<string, string>)[verdict] ?? verdict
    : FEFO_STRINGS.notInspected;
  const days = batch.daysUntilExpiry;
  const left =
    days === null || days === undefined
      ? EMPTY_VALUE
      : batch.status === 'EXPIRED'
        ? RAIL_STRINGS.expiredAgo(Math.abs(days))
        : RAIL_STRINGS.daysLeft(days);
  const errorBody =
    shownCode === 'DISPATCH_OUT_OF_ORDER' && earlierBatchCode
      ? S.outOfOrderBody(earlierBatchCode, code, batch.sku ?? '')
      : shownCode === 'QUALITY_HOLD'
        ? S.holdBody
        : shownCode === 'BATCH_EXPIRED'
          ? S.expiredBody
          : serverError;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={requiresOverride ? S.titleOutOfOrder(code) : S.title(code)}
      description={`${batch.productName ?? ''} (${batch.sku ?? ''})`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
            data-testid="dispatch-cancel-btn"
          >
            {S.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="dispatch-batch-form"
            isLoading={mutation.isPending}
            disabled={mutation.isPending || shownCode === 'BATCH_EXPIRED' || shownCode === 'QUALITY_HOLD'}
            data-testid="dispatch-submit-btn"
          >
            {requiresOverride ? S.confirmWithReason : S.confirm}
          </Button>
        </>
      }
    >
      <form id="dispatch-batch-form" onSubmit={handleSubmit} className={coreStyles.pageStack} noValidate>
        <p className={coreStyles.sectionSubtitle} data-testid="dispatch-summary">
          {S.summary(formatBusinessDate(batch.expiryDate), left, quality)}
        </p>

        {verdict === 'FLAGGED' && !shownCode ? (
          <div
            className={`${coreStyles.alertBanner} ${coreStyles.alertWarning}`}
            role="status"
            data-testid="dispatch-flagged-advisory"
          >
            {S.flagged}
          </div>
        ) : null}

        {shownCode || serverError ? (
          <div
            className={`${coreStyles.alertBanner} ${
              shownCode === 'DISPATCH_OUT_OF_ORDER' ? coreStyles.alertWarning : coreStyles.alertDanger
            }`}
            role="alert"
            data-testid="dispatch-error-banner"
            data-error-code={shownCode ?? undefined}
          >
            <div>
              <strong>{(shownCode && S.errors[shownCode]) || S.errors.fallback}.</strong>{' '}
              <span
                data-testid={shownCode === 'DISPATCH_OUT_OF_ORDER' && earlierBatchCode ? 'dispatch-earlier-batch-code' : undefined}
              >
                {errorBody}
              </span>
            </div>
          </div>
        ) : null}

        <Field label={S.buyer} required error={fieldErrors.buyerName}>
          <Input
            value={buyerName}
            onChange={(e) => {
              setBuyerName(e.target.value);
              if (fieldErrors.buyerName) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.buyerName;
                  return next;
                });
              }
            }}
            placeholder={S.buyerPlaceholder}
            disabled={mutation.isPending || Boolean(blockedCode)}
            data-testid="dispatch-buyer-input"
          />
        </Field>

        <Field label={S.date} hint={S.dateHint} error={fieldErrors.dispatchDate}>
          <Input
            type="date"
            value={dispatchDate}
            onChange={(e) => setDispatchDate(e.target.value)}
            disabled={mutation.isPending || Boolean(blockedCode)}
            data-testid="dispatch-date-input"
          />
        </Field>

        {requiresOverride && canOverride ? (
          <Field label={S.overrideReason} required hint={S.overrideHint} error={fieldErrors.overrideReason}>
            <Textarea
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (fieldErrors.overrideReason) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.overrideReason;
                    return next;
                  });
                }
              }}
              placeholder={S.overridePlaceholder}
              disabled={mutation.isPending}
              data-testid="dispatch-override-reason-input"
            />
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
