"use client";

import Link from "next/link";
import { statusesConfig } from "@/config/statuses";
import { useStorefrontOrderTracking } from "@/modules/storefront/hooks/useStorefrontOrderTracking";

export function OrderTrackingPage({ trackingToken }: { trackingToken: string }) {
  const { data, loading, error, reload } = useStorefrontOrderTracking(trackingToken);

  if (loading)
    return (
      <main className="mx-auto max-w-4xl px-5 py-12 text-[var(--color-text-muted)]">
        Cargando pedido...
      </main>
    );
  if (error || !data)
    return (
      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-3xl font-black">Seguimiento de pedido</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          {error ?? "No se encontró el pedido."}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-[var(--color-topbar)]"
            onClick={reload}
            type="button"
          >
            Reintentar
          </button>
          <Link
            className="rounded-xl border border-[var(--color-border)] px-4 py-3 font-bold"
            href="/catalogo"
          >
            Ver catálogo
          </Link>
        </div>
      </main>
    );

  const status = statusesConfig[data.status];
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link className="text-sm font-bold text-[var(--color-title)]" href="/catalogo">
        ← Seguir comprando
      </Link>
      <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="bg-[var(--color-topbar)] px-6 py-7 text-white">
          <p className="text-sm text-slate-300">Pedido {data.orderNumber}</p>
          <h1 className="mt-2 text-3xl font-black">Seguimiento de pedido</h1>
          <p className="mt-3 inline-block rounded-full bg-[var(--color-primary)]/20 px-3 py-1 text-sm font-bold text-[var(--color-primary)]">
            {status?.label ?? data.status}
          </p>
        </div>
        <div className="p-6">
          <section className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
              Estado actual
            </p>
            <p className="mt-2 text-xl font-black text-[var(--color-text)]">
              {status?.label ?? data.status}
            </p>
          </section>
          <div className="mt-8 space-y-3">
            {data.items.map((item, index) => (
              <article
                key={`${item.sku}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
                    {item.sku}
                  </p>
                  <h2 className="mt-1 font-black text-[var(--color-text)]">{item.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Cantidad · {item.quantity}
                  </p>
                </div>
                <p className="font-black text-[var(--color-text)]">Q{item.subtotal.toFixed(2)}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-5">
            <span className="font-bold text-[var(--color-text)]">Total</span>
            <span className="text-3xl font-black text-[var(--color-title)]">
              Q{data.total.toFixed(2)}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
