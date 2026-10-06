import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { dispatchBatch } from '../../api/endpoints';
import type { BatchDetailDto, BatchSummaryDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canDispatchBatch } from '../../auth/permissions.generated';
import { Button, Dialog, Field, Input, Textarea, useToast } from '../../components/ui';

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
          title: 'Batch dispatched with quality warning',
          description: warningMsg,
          variant: 'warning'
        });
      } else {
        pushToast({
          title: 'Batch dispatched',
          description: `${res.data.batchCode ?? 'Batch'} dispatched to ${res.data.buyerName ?? buyerName.trim()}.`,
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
      nextFieldErrors.buyerName = 'Buyer name is required.';
    }
    if (requiresOverride && !overrideReason.trim()) {
      nextFieldErrors.overrideReason = 'An override reason is required for out-of-order FEFO dispatch.';
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

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`Dispatch Batch ${batch.batchCode ?? ''}`}
      description={`${batch.productName ?? ''} (${batch.sku ?? ''})`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
            data-testid="dispatch-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="dispatch-batch-form"
            isLoading={mutation.isPending}
            disabled={
              mutation.isPending ||
              errorCode === 'BATCH_EXPIRED' ||
              errorCode === 'QUALITY_HOLD'
            }
            data-testid="dispatch-submit-btn"
          >
            {requiresOverride ? 'Confirm Override & Dispatch' : 'Confirm Dispatch'}
          </Button>
        </>
      }
    >
      <form id="dispatch-batch-form" onSubmit={handleSubmit} className={coreStyles.pageStack} noValidate>
        {batch.qualityCheck?.status === 'FLAGGED' ? (
          <div
            className={`${coreStyles.alertBanner} ${coreStyles.alertWarning}`}
            role="status"
            data-testid="dispatch-flagged-advisory"
          >
            <strong>Quality Advisory (FLAGGED):</strong> Latest inspection verdict is FLAGGED.
            Dispatch is permitted, and the server will record a quality advisory warning.
          </div>
        ) : null}

        {serverError ? (
          <div
            className={`${coreStyles.alertBanner} ${
              errorCode === 'DISPATCH_OUT_OF_ORDER'
                ? coreStyles.alertWarning
                : coreStyles.alertDanger
            }`}
            role="alert"
            data-testid="dispatch-error-banner"
          >
            <div>
              <strong>{errorCode ?? 'Dispatch Error'}:</strong> {serverError}
            </div>
            {errorCode === 'DISPATCH_OUT_OF_ORDER' && earlierBatchCode ? (
              <div data-testid="dispatch-earlier-batch-code">
                Earlier eligible batch for SKU <strong>{batch.sku}</strong>:{' '}
                <strong className={coreStyles.monoCode}>{earlierBatchCode}</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        <Field
          label="Buyer / Recipient Name"
          required
          error={fieldErrors.buyerName}
        >
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
            placeholder="e.g. Himalayan Organic Retail Co."
            disabled={mutation.isPending}
            data-testid="dispatch-buyer-input"
          />
        </Field>

        <Field
          label="Dispatch Date (optional)"
          hint="Format: YYYY-MM-DD. Defaults to the current business date on the server if left blank."
          error={fieldErrors.dispatchDate}
        >
          <Input
            type="date"
            value={dispatchDate}
            onChange={(e) => setDispatchDate(e.target.value)}
            disabled={mutation.isPending}
            data-testid="dispatch-date-input"
          />
        </Field>

        {requiresOverride && canOverride ? (
          <Field
            label="FEFO Out-of-Order Override Reason"
            required
            hint="Required by D-14/D-18 because an earlier-expiring batch of the same SKU is in the queue. This override is recorded in the audit log."
            error={fieldErrors.overrideReason}
          >
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
              placeholder="Explain why this batch is being dispatched ahead of the earlier-expiring batch…"
              disabled={mutation.isPending}
              data-testid="dispatch-override-reason-input"
            />
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
