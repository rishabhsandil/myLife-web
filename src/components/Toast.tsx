import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import './Toast.css';

export type ToastVariant = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void;
  showError: (err: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const TOAST_DURATION_MS = 4000;

/**
 * App-wide toast/notification surface.
 *
 * Use `useToast()` in components to surface user-visible messages instead of
 * `console.error` or silent failures. `showError` accepts the unknown
 * exception type from `try/catch` and pulls a sensible message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }, [dismiss]);

  const showError = useCallback((err: unknown, fallback = 'Something went wrong') => {
    const message = err instanceof Error ? err.message : fallback;
    show(message, 'error');
  }, [show]);

  const api: ToastApi = { show, showError };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <button
            key={t.id}
            type="button"
            className={`toast toast-${t.variant}`}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/**
 * Wires a global handler so unhandled fetch errors can be surfaced.
 * Mount once near the top of the tree (already done in App.tsx).
 */
export function useGlobalRejectionToast() {
  const { showError } = useToast();
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      // Only surface user-friendly messages; ignore aborted fetches.
      const reason = e.reason;
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      showError(reason, 'Request failed');
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [showError]);
}
