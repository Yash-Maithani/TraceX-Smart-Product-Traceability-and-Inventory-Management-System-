import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import coreStyles from '../core/core.module.css';
import batchStyles from '../batches/batches.module.css';
import { ApiError } from '../../api/client';
import { fetchProducts } from '../../api/endpoints';
import type { ProductDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { canManageProducts } from '../../auth/permissions.generated';
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Table,
  type TableColumn
} from '../../components/ui';
import { PRODUCT_STRINGS as S } from '../../strings/products';
import { ProductDialog, effectiveShelfLife } from './ProductDialog';

function allergenText(p: ProductDto): string {
  return p.allergens && p.allergens.length > 0 ? p.allergens.join(', ') : S.noAllergens;
}

export function ProductsPage() {
  const { user } = useAuth();
  const canEdit = canManageProducts(user);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  const all = productsQuery.data ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((p) => [p.productName, p.sku, p.category].some((v) => (v ?? '').toLowerCase().includes(q)))
    : all;

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: ProductDto) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const columns: TableColumn<ProductDto>[] = [
    {
      key: 'product',
      header: S.columns.product,
      render: (row) => (
        <div>
          <div>
            <strong>{row.productName}</strong>
          </div>
          <div className={coreStyles.monoCode}>{row.sku}</div>
        </div>
      )
    },
    { key: 'category', header: S.columns.category, render: (row) => <span>{row.category}</span> },
    {
      key: 'shelfLife',
      header: S.columns.shelfLife,
      nowrap: true,
      render: (row) => <span>{S.days(effectiveShelfLife(row))}</span>
    },
    {
      key: 'risk',
      header: S.columns.risk,
      nowrap: true,
      render: (row) => <span>{S.risk[(row.riskLevel ?? '').toUpperCase()] ?? row.riskLevel}</span>
    },
    { key: 'allergens', header: S.columns.allergens, render: (row) => <span>{allergenText(row)}</span> },
    ...(canEdit
      ? [
          {
            key: 'action',
            header: S.columns.action,
            render: (row: ProductDto) => (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Pencil size={14} />}
                aria-label={S.editLabel(row.productName ?? '')}
                onClick={() => openEdit(row)}
                data-testid={`edit-product-${row.sku}`}
              >
                {S.edit}
              </Button>
            )
          }
        ]
      : [])
  ];

  return (
    <div className={coreStyles.pageStack} data-testid="products-page">
      <PageHeader
        title={S.title}
        subtitle={S.subtitle}
        meta={
          productsQuery.isSuccess ? (
            <span className={batchStyles.countChip} data-testid="products-count">
              {S.count(all.length)}
            </span>
          ) : undefined
        }
        actions={
          canEdit ? (
            <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openAdd} data-testid="add-product-btn">
              {S.add}
            </Button>
          ) : undefined
        }
        backdropKey="batches"
        priority
      />

      {!canEdit ? <p className={coreStyles.sectionSubtitle}>{S.viewOnly}</p> : null}

      {all.length > 0 ? (
        <section className={batchStyles.toolbar} aria-label={S.searchLabel}>
          <label className={batchStyles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{S.searchLabel}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={S.searchPlaceholder}
              data-testid="products-search"
            />
          </label>
        </section>
      ) : null}

      {productsQuery.isPending ? (
        <div className={coreStyles.sectionCard} aria-busy="true">
          <Skeleton label={S.loading} />
        </div>
      ) : productsQuery.isError ? (
        <ErrorState
          title={S.errorTitle}
          description={productsQuery.error instanceof Error ? productsQuery.error.message : S.errorBody}
          requestId={productsQuery.error instanceof ApiError ? productsQuery.error.requestId : undefined}
          onRetry={() => void productsQuery.refetch()}
        />
      ) : all.length === 0 ? (
        <EmptyState title={S.emptyTitle} description={canEdit ? S.emptyCanAdd : S.emptyCannotAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState title={S.noMatchTitle} description={S.noMatchBody} />
      ) : (
        <>
          <div className={coreStyles.desktopTableWrap}>
            <Table caption={S.caption} columns={columns} data={filtered} rowKey={(row) => row.id ?? row.sku ?? ''} />
          </div>
          <div className={coreStyles.mobileCardList}>
            {filtered.map((row) => (
              <article key={row.id ?? row.sku} className={coreStyles.itemCard} data-testid={`product-card-${row.sku}`}>
                <div className={coreStyles.itemCardHeader}>
                  <strong>{row.productName}</strong>
                  <span className={coreStyles.monoCode}>{row.sku}</span>
                </div>
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>{S.columns.shelfLife}</span>
                  <span className={coreStyles.metaValue}>{S.days(effectiveShelfLife(row))}</span>
                </div>
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>{S.columns.risk}</span>
                  <span className={coreStyles.metaValue}>{S.risk[(row.riskLevel ?? '').toUpperCase()] ?? row.riskLevel}</span>
                </div>
                <div className={coreStyles.metaItem}>
                  <span className={coreStyles.metaLabel}>{S.columns.allergens}</span>
                  <span className={coreStyles.metaValue}>{allergenText(row)}</span>
                </div>
                {canEdit ? (
                  <div>
                    <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => openEdit(row)}>
                      {S.edit}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}

      <ProductDialog open={dialogOpen} onClose={() => setDialogOpen(false)} product={editing} />
    </div>
  );
}
