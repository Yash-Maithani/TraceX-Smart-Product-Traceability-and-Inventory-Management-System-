import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { createBatch, fetchProducts } from '../../api/endpoints';
import type { BatchDetailDto } from '../../api/types';
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from '../../components/ui';

export interface CreateBatchDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (batch: BatchDetailDto) => void;
}

const UNIT_OPTIONS = ['Kg', 'Units', 'Liters'] as const;

export function CreateBatchDialog({ open, onClose, onCreated }: CreateBatchDialogProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    enabled: open
  });

  const [productId, setProductId] = useState('');
  const [packDate, setPackDate] = useState('2026-10-06');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityProduced, setQuantityProduced] = useState('150');
  const [unit, setUnit] = useState('Kg');
  const [yieldPercent, setYieldPercent] = useState('85');
  const [sourceLotCode, setSourceLotCode] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [village, setVillage] = useState('');
  const [traceabilityNote, setTraceabilityNote] = useState('');

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdBatch, setCreatedBatch] = useState<BatchDetailDto | null>(null);

  useEffect(() => {
    if (open && productsQuery.data && productsQuery.data.length > 0 && !productId) {
      setProductId(productsQuery.data[0]?.id ?? '');
    }
  }, [open, productsQuery.data, productId]);

  useEffect(() => {
    if (!open) {
      setServerError(null);
      setFieldErrors({});
      setCreatedBatch(null);
      setSourceLotCode('');
      setFarmerName('');
      setVillage('');
      setTraceabilityNote('');
      setExpiryDate('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const qty = Number.parseInt(quantityProduced, 10);
      const yld = Number.parseFloat(yieldPercent);
      return createBatch({
        productId: productId.trim(),
        packDate: packDate.trim(),
        ...(expiryDate.trim() ? { expiryDate: expiryDate.trim() } : {}),
        quantityProduced: Number.isNaN(qty) ? 0 : qty,
        unit: unit.trim(),
        yieldPercent: Number.isNaN(yld) ? 0 : yld,
        sourceLotCode: sourceLotCode.trim(),
        farmerName: farmerName.trim(),
        village: village.trim(),
        ...(traceabilityNote.trim() ? { traceabilityNote: traceabilityNote.trim() } : {})
      });
    },
    onSuccess: async (res) => {
      setCreatedBatch(res.data);
      setServerError(null);
      setFieldErrors({});

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['fefo'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      ]);

      pushToast({
        title: 'Batch created',
        description: `Generated batch code ${res.data.batchCode ?? ''}.`,
        variant: 'success'
      });

      if (onCreated) {
        onCreated(res.data);
      }
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
        setServerError(err instanceof Error ? err.message : 'Unable to create batch.');
      }
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mutation.isPending) return;
    setServerError(null);
    setFieldErrors({});
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Create Production Batch"
      description="Register a new batch with provenance metadata. The server allocates an atomic TX-YYYY-MM-NNN code."
      actions={
        createdBatch ? (
          <>
            <Button variant="secondary" onClick={onClose} data-testid="create-batch-done-btn">
              Close
            </Button>
            {createdBatch.id ? (
              <Link to={`/batches/${createdBatch.id}`} onClick={onClose}>
                <Button variant="primary" data-testid="view-created-batch-btn">
                  View Batch {createdBatch.batchCode}
                </Button>
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={mutation.isPending}
              data-testid="create-batch-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-batch-form"
              isLoading={mutation.isPending}
              disabled={mutation.isPending}
              data-testid="create-batch-submit-btn"
            >
              Create Batch
            </Button>
          </>
        )
      }
    >
      {createdBatch ? (
        <div
          className={`${coreStyles.alertBanner} ${coreStyles.alertSuccess}`}
          role="status"
          data-testid="created-batch-banner"
        >
          <div>
            Batch created and persisted. Allocated code:{' '}
            <strong className={coreStyles.monoCode} data-testid="created-batch-code">
              {createdBatch.batchCode}
            </strong>
          </div>
          <div>
            Product: <strong>{createdBatch.productName}</strong> ({createdBatch.sku}) — Expiry:{' '}
            <strong>{createdBatch.expiryDate}</strong>
          </div>
        </div>
      ) : (
        <form id="create-batch-form" onSubmit={handleSubmit} className={coreStyles.pageStack} noValidate>
          {serverError ? (
            <div
              className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
              role="alert"
              data-testid="create-batch-error"
            >
              {serverError}
            </div>
          ) : null}

          <Field label="Product" required error={fieldErrors.productId}>
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={mutation.isPending || productsQuery.isPending}
              data-testid="create-batch-product-select"
            >
              <option value="">Select a product…</option>
              {(productsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName} ({p.sku})
                </option>
              ))}
            </Select>
          </Field>

          <div className={coreStyles.twoColumnGrid}>
            <Field label="Pack Date" required error={fieldErrors.packDate}>
              <Input
                type="date"
                value={packDate}
                onChange={(e) => setPackDate(e.target.value)}
                disabled={mutation.isPending}
                data-testid="create-batch-pack-date"
              />
            </Field>

            <Field
              label="Expiry Date Override (optional)"
              hint="Leave blank to calculate from product shelf life."
              error={fieldErrors.expiryDate}
            >
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={mutation.isPending}
                data-testid="create-batch-expiry-date"
              />
            </Field>
          </div>

          <div className={coreStyles.threeColumnGrid}>
            <Field label="Quantity Produced" required error={fieldErrors.quantityProduced}>
              <Input
                type="number"
                min={1}
                value={quantityProduced}
                onChange={(e) => setQuantityProduced(e.target.value)}
                disabled={mutation.isPending}
                data-testid="create-batch-quantity"
              />
            </Field>

            <Field label="Unit" required error={fieldErrors.unit}>
              <Select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={mutation.isPending}
                data-testid="create-batch-unit"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Yield (%)" required error={fieldErrors.yieldPercent}>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                max={100}
                value={yieldPercent}
                onChange={(e) => setYieldPercent(e.target.value)}
                disabled={mutation.isPending}
                data-testid="create-batch-yield"
              />
            </Field>
          </div>

          <div className={coreStyles.threeColumnGrid}>
            <Field label="Source Lot Code" required error={fieldErrors.sourceLotCode}>
              <Input
                value={sourceLotCode}
                onChange={(e) => setSourceLotCode(e.target.value)}
                placeholder="e.g. LOT-2026-101"
                disabled={mutation.isPending}
                data-testid="create-batch-lot-code"
              />
            </Field>

            <Field label="Farmer Name" required error={fieldErrors.farmerName}>
              <Input
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                placeholder="e.g. Ramesh Negi"
                disabled={mutation.isPending}
                data-testid="create-batch-farmer-name"
              />
            </Field>

            <Field label="Source Village" required error={fieldErrors.village}>
              <Input
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Lansdowne"
                disabled={mutation.isPending}
                data-testid="create-batch-village"
              />
            </Field>
          </div>

          <Field label="Traceability Note (optional)" error={fieldErrors.traceabilityNote}>
            <Textarea
              value={traceabilityNote}
              onChange={(e) => setTraceabilityNote(e.target.value)}
              placeholder="Harvest conditions, processing batch notes…"
              disabled={mutation.isPending}
              data-testid="create-batch-note"
            />
          </Field>
        </form>
      )}
    </Dialog>
  );
}
