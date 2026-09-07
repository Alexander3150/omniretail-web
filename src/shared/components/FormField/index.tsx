import type { ReactNode } from "react";
export interface FormFieldProps {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}
export function FormField({ id, label, children, hint, error }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
