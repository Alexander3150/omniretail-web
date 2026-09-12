"use client";

import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";

export function InicioPage() {
  const { role, user } = useCurrentSession();

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">OmniRetail</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--color-title)]">
        Hola{user?.name ? `, ${user.name}` : ""}
      </h1>
      <p className="mt-3 text-[var(--color-text)]">
        {role ? `Sesión activa como ${role.name}.` : "Sesión activa."}
      </p>
    </section>
  );
}
