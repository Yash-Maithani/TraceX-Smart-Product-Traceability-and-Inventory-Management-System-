import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './ui.module.css';
import { Button } from './Button';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string | undefined;
  tone: ToastTone;
}

export interface PushToastInput {
  title: string;
  description?: string | undefined;
  tone?: ToastTone | undefined;
  variant?: ToastTone | undefined;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  pushToast: (toast: PushToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: PushToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const resolvedTone: ToastTone = toast.tone ?? toast.variant ?? 'info';
      setToasts((prev) => [
        ...prev.slice(-(MAX_TOASTS - 1)),
        {
          id,
          title: toast.title,
          ...(toast.description !== undefined ? { description: toast.description } : {}),
          tone: resolvedTone
        }
      ]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 5000);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, pushToast, dismissToast }}>
      {children}
      <div className={styles.toastViewport} role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const toneClass =
            t.tone === 'success'
              ? styles.toastSuccess
              : t.tone === 'error'
                ? styles.toastError
                : styles.toastInfo;
          const role = t.tone === 'error' ? 'alert' : 'status';
          const ariaLive = t.tone === 'error' ? 'assertive' : 'polite';

          return (
            <div key={t.id} role={role} aria-live={ariaLive} className={`${styles.toastItem} ${toneClass}`}>
              <div>
                <strong>{t.title}</strong>
                {t.description ? <div>{t.description}</div> : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Dismiss notification"
                onClick={() => dismissToast(t.id)}
                leftIcon={<X size={14} />}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
