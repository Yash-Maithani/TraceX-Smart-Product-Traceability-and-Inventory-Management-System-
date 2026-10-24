import { useEffect, useState } from 'react';
import { CalendarRange, ChevronDown, X } from 'lucide-react';
import styles from './console.module.css';
import { Button } from './Button';
import { Popover } from './Popover';
import { formatBusinessDate } from '../../lib/dates';
import { DATE_RANGE_STRINGS as S } from '../../strings/common';

export interface DateRangeChipProps {
  label: string;
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  /** Base test id: the chip, `-menu`, `-from`, `-to` and `-apply` are derived from it. */
  testId: string;
}

/** A filter chip that opens two date fields (backend request B-2: batch expiry and inspection dates). */
export function DateRangeChip({ label, fromLabel, toLabel, from, to, onApply, testId }: DateRangeChipProps) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);
  const active = Boolean(from || to);
  const invalid = Boolean(draftFrom && draftTo && draftFrom > draftTo);

  return (
    <span className={styles.chipGroup}>
      <Popover
        label={label}
        align="start"
        testId={`${testId}-menu`}
        renderTrigger={({ ref, ...p }) => (
          <button ref={ref} type="button" {...p} className={`${styles.chip} ${active ? styles.chipActive : ''}`} data-testid={testId}>
            <CalendarRange size={14} aria-hidden="true" />
            <span>{label}</span>
            {active ? (
              <span className={styles.chipValue}>
                {S.range(from ? formatBusinessDate(from) : '', to ? formatBusinessDate(to) : '')}
              </span>
            ) : null}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
      >
        {(close) => (
          <form
            className={styles.rangeForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (invalid) return;
              onApply(draftFrom, draftTo);
              close();
            }}
          >
            <label className={styles.rangeField}>
              <span>{fromLabel}</span>
              <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} data-testid={`${testId}-from`} />
            </label>
            <label className={styles.rangeField}>
              <span>{toLabel}</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                data-testid={`${testId}-to`}
                aria-invalid={invalid || undefined}
              />
            </label>
            <div className={styles.rangeActions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftFrom('');
                  setDraftTo('');
                  onApply('', '');
                  close();
                }}
              >
                {S.clear}
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={invalid} data-testid={`${testId}-apply`}>
                {S.apply}
              </Button>
            </div>
          </form>
        )}
      </Popover>
      {active ? (
        <button type="button" className={styles.chipClear} aria-label={S.clear} onClick={() => onApply('', '')}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
