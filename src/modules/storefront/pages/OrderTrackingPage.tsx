"use client";

import Link from "next/link";
import { OrderStatus } from "@/core/enums";
import { useStorefrontOrderTracking } from "@/modules/storefront/hooks/useStorefrontOrderTracking";

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.pending]: "Pendiente de confirmación",
  [OrderStatus.confirmed]: "Confirmado",
  [OrderStatus.preparing]: "En preparación",
  [OrderStatus.picking]: "En recolección",
  [OrderStatus.packing]: "En empaque",
  [OrderStatus.ready_for_pickup]: "Listo para retiro",
  [OrderStatus.ready_for_dispatch]: "Listo para despacho",
  [OrderStatus.dispatched]: "En camino",
  [OrderStatus.delivered]: "Entregado",
  [OrderStatus.cancelled]: "Cancelado",
};

export function OrderTrackingPage({ trackingToken }: { trackingToken: string }) {
  const { data, loading, error, reload } = useStorefrontOrderTracking(trackingToken);

  if (loading) {
    return <main className="mx-auto max-w-3xl px-5 py-10">Cargando pedido...</main>;
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Seguimiento de pedido</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">{error ?? "No se encontró el pedido."}</p>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]" onClick={reload} type="button">
            Reintentar
          </button>
          <Link className="rounded-md border border-[var(--color-border)] px-4 py-2 font-semibold" href="/catalogo">
            Ver catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link className="text-sm font-semibold text-[var(--color-primary)]" href="/catalogo">← Seguir comprando</Link>
      <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">Pedido {data.orderNumber}</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Seguimiento de pedido</h1>
        <p className="mt-4 inline-block rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
          {statusLabels[data.status]}
        </p>

        <div className="mt-6 space-y-3">
          {data.items.map((item, index) => (
            <article key={`${item.sku}-${index}`} className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Código: {item.sku}</p>
                <h2 className="font-semibold text-[var(--color-text)]">{item.name}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Cantidad: {item.quantity}</p>
              </div>
              <p className="font-semibold text-[var(--color-text)]">Q{item.subtotal.toFixed(2)}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="font-semibold text-[var(--color-text)]">Total</span>
          <span className="text-2xl font-bold text-[var(--color-title)]">Q{data.total.toFixed(2)}</span>
        </div>
      </section>
    </main>
  );
}
