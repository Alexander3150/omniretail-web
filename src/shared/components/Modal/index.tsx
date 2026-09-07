"use client";
import type { ReactNode } from "react";
import { Button } from "@/shared/components/Button";
export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}
export function Modal({ open, title, children, onClose, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded-md bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--color-title)]">{title}</h2>
          <Button onClick={onClose} type="button">
            Cerrar
          </Button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-[var(--color-border)] px-5 py-4">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}
