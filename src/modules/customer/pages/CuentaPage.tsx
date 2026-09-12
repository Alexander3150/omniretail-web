"use client";

import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";

const COMING_SOON_ITEMS = ["Mis pedidos", "Direcciones", "Métodos de pago"];

export function CuentaPage() {
  const { user } = useCurrentSession();

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">Mi cuenta</h1>
      <p className="mt-3 text-[var(--color-text)]">
        {user?.name ?? "Cliente"}
        {user?.email ? ` · ${user.email}` : ""}
      </p>

      <ul className="mt-6 space-y-2">
        {COMING_SOON_ITEMS.map((label) => (
          <li key={label}>
            <span
              className="cursor-not-allowed text-sm font-semibold text-[var(--color-text-muted)]"
              title="Próximamente"
            >
              {label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
