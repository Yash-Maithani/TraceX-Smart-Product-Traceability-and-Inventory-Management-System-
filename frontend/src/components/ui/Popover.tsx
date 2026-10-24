import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes
} from 'react';
import styles from './console.module.css';

export interface PopoverProps {
  /** Renders the trigger; spread the given props onto a <button>. */
  renderTrigger: (props: ButtonHTMLAttributes<HTMLButtonElement> & { ref: (el: HTMLButtonElement | null) => void }) => ReactNode;
  /** Panel content; `close` returns focus to the trigger. */
  children: (close: () => void) => ReactNode;
  /** Accessible name of the panel. */
  label: string;
  align?: 'start' | 'end';
  /** Opens upward (for triggers at the bottom of the screen, such as the sidebar user menu). */
  placement?: 'down' | 'up';
  testId?: string | undefined;
}

/**
 * Disclosure popover (button + panel). Escape and an outside click close it and focus returns to
 * the trigger. Used for the display menu, the account menu and filter chips (DESIGN.md §4).
 */
export function Popover({ renderTrigger, children, label, align = 'end', placement = 'down', testId }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], select, input, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, close]);

  const panelClass = [
    styles.popoverPanel,
    align === 'start' ? styles.popoverAlignStart : styles.popoverAlignEnd,
    placement === 'up' ? styles.popoverPanelUp : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.popoverRoot} ref={rootRef}>
      {renderTrigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        'aria-expanded': open,
        'aria-controls': panelId,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen((v) => !v)
      })}
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className={panelClass}
          data-testid={testId}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
