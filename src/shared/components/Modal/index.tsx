"use client";
import { useEffect } from "react";
import type { ReactNode } from "react";
export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}
export function Modal({ open, title, subtitle, children, onClose, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-topbar)]/35 p-4"
      role="presentation"
    >
      <button aria-label="Cerrar" className="absolute inset-0" onClick={onClose} type="button" />
      <section
        aria-modal="true"
        className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-app-background)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-title)]">{title}</h2>
            {subtitle ? (
              <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-white text-lg font-bold text-[var(--color-title)] transition hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="max-h-[calc(90vh-9rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-[var(--color-border)] bg-white px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
