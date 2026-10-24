import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Boxes, FileText, Plus, Search } from 'lucide-react';
import styles from './console.module.css';
import { StatusBadge } from './StatusBadge';
import type { StatusBadgeValue } from './statusMap';
import { fetchBatches } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { canCreateBatch, canViewBatches } from '../../auth/permissions.generated';
import { getEnabledNavRoutes } from '../../routes/navConfig';
import { PALETTE_STRINGS } from '../../strings/common';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteOption {
  id: string;
  group: 'pages' | 'actions' | 'batches';
  label: string;
  meta?: string | undefined;
  icon: ReactNode;
  badge?: StatusBadgeValue | undefined;
  mono?: boolean | undefined;
  to: string;
}

const SEARCH_DELAY_MS = 200;
const MIN_SEARCH_CHARS = 2;
const MAX_BATCH_RESULTS = 6;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Ctrl+K command palette (DESIGN.md §4, RESEARCH.md Theme 1): pages, role-allowed actions and a live
 * batch search through the existing GET /api/v1/batches?search= endpoint. Combobox + listbox pattern.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebounced(term.trim(), SEARCH_DELAY_MS);
  const canSearchBatches = canViewBatches(user);

  const batchQuery = useQuery({
    queryKey: ['palette', 'batches', debounced],
    queryFn: () => fetchBatches({ search: debounced, limit: MAX_BATCH_RESULTS, page: 1 }),
    enabled: open && canSearchBatches && debounced.length >= MIN_SEARCH_CHARS,
    staleTime: 15_000
  });

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setTerm('');
    setActiveIndex(0);
    inputRef.current?.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  const options = useMemo<PaletteOption[]>(() => {
    const q = term.trim().toLowerCase();
    const pages: PaletteOption[] = getEnabledNavRoutes(user)
      .filter((r) => !q || r.label.toLowerCase().includes(q))
      .map((r) => ({
        id: `page-${r.path}`,
        group: 'pages',
        label: r.label,
        icon: <FileText size={16} aria-hidden="true" />,
        to: r.path
      }));
    const actions: PaletteOption[] = [];
    if (canCreateBatch(user) && (!q || PALETTE_STRINGS.createBatch.toLowerCase().includes(q))) {
      actions.push({
        id: 'action-create-batch',
        group: 'actions',
        label: PALETTE_STRINGS.createBatch,
        icon: <Plus size={16} aria-hidden="true" />,
        to: '/batches/new'
      });
    }
    const batches: PaletteOption[] =
      debounced.length >= MIN_SEARCH_CHARS
        ? (batchQuery.data?.data ?? []).map((b) => ({
            id: `batch-${b.id ?? b.batchCode ?? ''}`,
            group: 'batches',
            label: b.batchCode ?? '',
            meta: b.productName ?? undefined,
            icon: <Boxes size={16} aria-hidden="true" />,
            badge: (b.status ?? undefined) as StatusBadgeValue | undefined,
            mono: true,
            to: `/batches/${b.id ?? ''}`
          }))
        : [];
    // An exact batch code goes first so Enter opens it straight away (Linear-style jump by id)
    const exact = batches.findIndex((b) => b.label.toLowerCase() === q);
    if (exact > 0) {
      const [hit] = batches.splice(exact, 1);
      if (hit) batches.unshift(hit);
    }
    return exact >= 0 ? [...batches, ...pages, ...actions] : [...pages, ...actions, ...batches];
  }, [term, debounced, user, batchQuery.data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [options.length, term]);

  if (!open) return null;

  const choose = (opt: PaletteOption | undefined) => {
    if (!opt) return;
    onClose();
    navigate(opt.to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (options.length === 0 ? 0 : (i + 1) % options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (options.length === 0 ? 0 : (i - 1 + options.length) % options.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[activeIndex]);
    } else if (e.key === 'Tab') {
      // Focus stays in the input; the list is navigated with the arrow keys
      e.preventDefault();
    }
  };

  const groups: PaletteOption['group'][] = ['batches', 'pages', 'actions'];
  const ordered = groups
    .map((g) => ({ g, items: options.filter((o) => o.group === g) }))
    .filter((x) => x.items.length > 0)
    .sort((a, b) => options.indexOf(a.items[0]!) - options.indexOf(b.items[0]!));

  const searching = batchQuery.isFetching && debounced.length >= MIN_SEARCH_CHARS;
  const activeId = options[activeIndex] ? `${listId}-${options[activeIndex]!.id}` : undefined;

  let message: string | null = null;
  if (batchQuery.isError) message = PALETTE_STRINGS.searchFailed;
  else if (searching) message = PALETTE_STRINGS.searching;
  else if (options.length === 0) message = PALETTE_STRINGS.noResults;
  else if (canSearchBatches && term.trim().length > 0 && term.trim().length < MIN_SEARCH_CHARS) message = PALETTE_STRINGS.minChars;

  return (
    <div
      className={styles.paletteBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.palettePanel}
        role="dialog"
        aria-modal="true"
        aria-label={PALETTE_STRINGS.dialogLabel}
        data-testid="command-palette"
      >
        <div className={styles.paletteInputRow}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.paletteInput}
            type="text"
            role="combobox"
            aria-label={PALETTE_STRINGS.inputLabel}
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder={PALETTE_STRINGS.placeholder}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            data-testid="command-palette-input"
          />
        </div>
        <div id={listId} role="listbox" aria-label={PALETTE_STRINGS.dialogLabel} className={styles.paletteList}>
          {ordered.map(({ g, items }) => (
            <div key={g} role="group" aria-labelledby={`${listId}-${g}`}>
              <div id={`${listId}-${g}`} role="presentation" className={styles.paletteGroup}>
                {PALETTE_STRINGS.groups[g]}
              </div>
              {items.map((o) => {
                const idx = options.indexOf(o);
                return (
                  <div
                    key={o.id}
                    id={`${listId}-${o.id}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    className={styles.paletteOption}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') choose(o);
                    }}
                    tabIndex={-1}
                    data-testid={`palette-option-${o.id}`}
                  >
                    {o.icon}
                    <span className={`${styles.paletteOptionMain} ${o.mono ? styles.paletteCode : ''}`}>{o.label}</span>
                    {o.meta ? <span className={styles.paletteMeta}>{o.meta}</span> : null}
                    {o.badge ? <StatusBadge status={o.badge} /> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {message ? (
          <div className={styles.paletteMessage} role="status">
            {message}
          </div>
        ) : null}
        <div className={styles.paletteFooter} aria-hidden="true">
          {PALETTE_STRINGS.hint}
        </div>
      </div>
    </div>
  );
}
