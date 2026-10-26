import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { createProduct, updateProduct } from '../../api/endpoints';
import type { ProductDto, ProductUpsertDto } from '../../api/types';
import { Button, Dialog, Field, Input, Select, Textarea, useToast } from '../../components/ui';
import { PRODUCT_STRINGS } from '../../strings/products';

const D = PRODUCT_STRINGS.dialog;
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  /** The product to edit; leave out to add a new one. */
  product?: ProductDto | null;
}

/** The shelf life batches actually use: an older predicted value wins over the base one. */
export function effectiveShelfLife(product: ProductDto): number {
  return product.predictedShelfLifeDays ?? product.baseShelfLifeDays ?? 0;
}

function splitAllergens(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }
  return out;
}

export function ProductDialog({ open, onClose, product }: ProductDialogProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const editing = Boolean(product?.id);

  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [riskLevel, setRiskLevel] = useState<string>('LOW');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [storage, setStorage] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setProductName(product?.productName ?? '');
    setSku(product?.sku ?? '');
    setCategory(product?.category ?? '');
    setShelfLifeDays(product ? String(effectiveShelfLife(product)) : '');
    setRiskLevel((product?.riskLevel ?? 'LOW').toUpperCase());
    setIngredients(product?.ingredients ?? '');
    setAllergens((product?.allergens ?? []).join(', '));
    setStorage(product?.storageInstructions ?? '');
    setServerError(null);
    setFieldErrors({});
  }, [open, product]);

  const mutation = useMutation({
    mutationFn: async () => {
      const days = Number.parseInt(shelfLifeDays, 10);
      const payload: ProductUpsertDto = {
        productName: productName.trim(),
        sku: sku.trim().toUpperCase(),
        category: category.trim(),
        shelfLifeDays: Number.isNaN(days) ? 0 : days,
        riskLevel,
        ingredients: ingredients.trim(),
        allergens: splitAllergens(allergens),
        storageInstructions: storage.trim()
      };
      return editing && product?.id ? updateProduct(product.id, payload) : createProduct(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      const name = saved.productName ?? productName.trim();
      pushToast(
        editing
          ? { title: D.savedTitle, description: D.savedBody(name), variant: 'success' }
          : { title: D.addedTitle, description: D.addedBody(name), variant: 'success' }
      );
      onClose();
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
        setServerError(err instanceof Error ? err.message : D.failed);
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

  const busy = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={editing ? D.editTitle(product?.productName ?? '') : D.addTitle}
      description={D.description}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} data-testid="product-cancel-btn">
            {D.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="product-form"
            isLoading={busy}
            disabled={busy}
            data-testid="product-save-btn"
          >
            {D.save}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className={coreStyles.pageStack} noValidate>
        {serverError ? (
          <div className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`} role="alert" data-testid="product-error">
            {serverError}
          </div>
        ) : null}

        <Field label={D.name} required error={fieldErrors.productName}>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={D.namePlaceholder}
            maxLength={120}
            disabled={busy}
            data-testid="product-name"
          />
        </Field>

        <div className={coreStyles.twoColumnGrid}>
          <Field label={D.sku} required hint={editing ? D.skuLocked : D.skuHint} error={fieldErrors.sku}>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              maxLength={12}
              readOnly={editing}
              disabled={busy}
              data-testid="product-sku"
            />
          </Field>
          <Field label={D.category} required error={fieldErrors.category}>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={D.categoryPlaceholder}
              maxLength={40}
              disabled={busy}
              data-testid="product-category"
            />
          </Field>
        </div>

        <div className={coreStyles.twoColumnGrid}>
          <Field label={D.shelfLife} required hint={D.shelfLifeHint} error={fieldErrors.shelfLifeDays}>
            <Input
              type="number"
              min={1}
              max={3650}
              value={shelfLifeDays}
              onChange={(e) => setShelfLifeDays(e.target.value)}
              disabled={busy}
              data-testid="product-shelf-life"
            />
          </Field>
          <Field label={D.risk} required hint={D.riskHint} error={fieldErrors.riskLevel}>
            <Select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              disabled={busy}
              data-testid="product-risk"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {D.riskOptions[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section aria-labelledby="product-label-heading" className={coreStyles.pageStack}>
          <div>
            <h3 id="product-label-heading" className={coreStyles.sectionTitle}>
              {D.labelHeading}
            </h3>
            <p className={coreStyles.sectionSubtitle}>{D.labelHint}</p>
          </div>
          <Field label={D.ingredients} error={fieldErrors.ingredients}>
            <Textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder={D.ingredientsPlaceholder}
              maxLength={1000}
              disabled={busy}
              data-testid="product-ingredients"
            />
          </Field>
          <Field label={D.allergens} hint={D.allergensHint} error={fieldErrors.allergens}>
            <Input
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              disabled={busy}
              data-testid="product-allergens"
            />
          </Field>
          <Field label={D.storage} error={fieldErrors.storageInstructions}>
            <Input
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              placeholder={D.storagePlaceholder}
              maxLength={300}
              disabled={busy}
              data-testid="product-storage"
            />
          </Field>
        </section>
      </form>
    </Dialog>
  );
}
