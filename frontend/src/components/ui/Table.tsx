import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ui.module.css';
import { Button } from './Button';
import { Skeleton } from './Spinner';
import { EmptyState } from './States';
import { useOptionalTheme } from '../../hooks/useTheme';
import { TABLE_STRINGS } from '../../strings/common';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  /** Codes, dates and short values that must never wrap (AUDIT #4). */
  nowrap?: boolean;
  /** Right-aligned tabular number column. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  caption: string;
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sortKey?: string | undefined;
  sortDirection?: 'asc' | 'desc' | undefined;
  onSortChange?: ((key: string) => void) | undefined;
}

const SKELETON_ROWS = 6;

function cellClass<T>(col: TableColumn<T>): string | undefined {
  if (col.numeric) return styles.cellNumeric;
  if (col.nowrap) return styles.cellNowrap;
  return undefined;
}

export function Table<T>({
  caption,
  columns,
  data,
  rowKey,
  isLoading = false,
  emptyTitle = TABLE_STRINGS.emptyTitle,
  emptyDescription = TABLE_STRINGS.emptyDescription,
  emptyAction,
  sortKey,
  sortDirection,
  onSortChange
}: TableProps<T>) {
  const density = useOptionalTheme()?.prefs.tableDensity ?? 'default';

  if (!isLoading && data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div
      className={styles.tableContainer}
      role="region"
      aria-label={caption}
      aria-busy={isLoading || undefined}
      data-density={density}
      // A table that scrolls inside its own box must be reachable by keyboard (axe scrollable-region-focusable)
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className={styles.tableCaption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const ariaSort = isSorted
                ? sortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : col.sortable
                  ? 'none'
                  : undefined;

              return (
                <th key={col.key} scope="col" aria-sort={ariaSort} className={cellClass(col)}>
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => onSortChange(col.key)}
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={13} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={13} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={13} aria-hidden="true" className={styles.sortIdle} />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }, (_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`} aria-hidden="true">
                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton label={TABLE_STRINGS.loadingRow} className={styles.skeletonLine} />
                    </td>
                  ))}
                </tr>
              ))
            : data.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((col) => (
                    <td key={col.key} className={cellClass(col)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {isLoading ? <span className="sr-only">{TABLE_STRINGS.loading(caption)}</span> : null}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50]
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  return (
    <nav className={styles.pagination} aria-label={TABLE_STRINGS.paginationLabel}>
      <div>
        {TABLE_STRINGS.showing} <strong>{startItem}</strong> {TABLE_STRINGS.to} <strong>{endItem}</strong>{' '}
        {TABLE_STRINGS.of} <strong>{totalItems}</strong>
      </div>
      <div className={styles.paginationControls}>
        {onPageSizeChange ? (
          <label>
            <span className="sr-only">{TABLE_STRINGS.rowsPerPage}</span>
            <select
              aria-label={TABLE_STRINGS.rowsPerPage}
              className={`${styles.inputBase} ${styles.pageSizeSelect}`}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {TABLE_STRINGS.perPage(opt)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span>{TABLE_STRINGS.pageOf(page, totalPages)}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={TABLE_STRINGS.previousPage}
          leftIcon={<ChevronLeft size={15} />}
        >
          {TABLE_STRINGS.previous}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={TABLE_STRINGS.nextPage}
          rightIcon={<ChevronRight size={15} />}
        >
          {TABLE_STRINGS.next}
        </Button>
      </div>
    </nav>
  );
}
