"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { StatusTone } from "@/config/statuses";
export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: StatusTone;
}
interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dismissToast = useCallback(
    (id: string) => setToasts((items) => items.filter((toast) => toast.id !== id)),
    [],
  );
  const showToast = useCallback(
    (toast: Omit<ToastMessage, "id">) =>
      setToasts((items) => [...items, { ...toast, id: crypto.randomUUID() }]),
    [],
  );
  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [dismissToast, showToast, toasts],
  );
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <button
            className="block w-80 rounded-md border border-[var(--color-border)] bg-white p-4 text-left shadow-lg"
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            type="button"
          >
            <strong className="block text-sm text-[var(--color-title)]">{toast.title}</strong>
            {toast.description ? (
              <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
                {toast.description}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
