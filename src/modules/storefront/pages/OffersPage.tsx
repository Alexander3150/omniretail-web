"use client";

import Image from "next/image";
import Link from "next/link";
import { useStorefrontOffers } from "@/modules/storefront/hooks/useStorefrontOffers";

export function OffersPage() {
  const { items, loading, error } = useStorefrontOffers();

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-10"><p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)]">Cargando ofertas...</p></main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
      <section className="overflow-hidden rounded-3xl bg-[var(--color-topbar)] px-6 py-9 text-white shadow-lg sm:px-10 sm:py-12">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-topbar)]">Ofertas activas</p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">Encuentra mejores precios para tu compra.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/75 sm:text-lg">Promociones disponibles para la tienda en línea, con precios claros y ahorro visible.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm font-medium text-white/80">
            <span className="rounded-full border border-white/20 px-3 py-1.5">Promociones vigentes</span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">Compra segura</span>
          </div>
        </div>
      </section>

      {error ? <p className="mt-7 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-surface)] p-5 text-[var(--color-danger)]">{error}</p> : null}
      {!error && items.length === 0 ? <p className="mt-7 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)]">No hay ofertas disponibles en este momento.</p> : null}

      {items.length > 0 ? <section className="mt-9"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--color-primary)]">Selección para ti</p><h2 className="mt-1 text-2xl font-bold text-[var(--color-title)]">Ofertas disponibles</h2></div><p className="text-sm text-[var(--color-text-muted)]">{items.length} producto{items.length === 1 ? "" : "s"} con promoción</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.productId} className="group flex min-h-72 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"><div className="flex items-start justify-between gap-3"><p className="rounded-full bg-[var(--color-primary)]/15 px-3 py-1 text-xs font-bold text-[var(--color-title)]">{item.promotionName}</p><span className="text-sm font-bold text-[var(--color-success)]">-Q{item.discount.toFixed(2)}</span></div>{item.imageUrl ? <Image alt={item.imageAlt ?? item.name} className="mt-5 h-40 w-full rounded-xl bg-slate-50 object-cover" height={160} src={item.imageUrl} width={400} /> : <div className="mt-5 flex h-40 items-center justify-center rounded-xl bg-slate-50 text-sm text-[var(--color-text-muted)]">Sin imagen disponible</div>}<p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{item.sku}</p><h3 className="mt-2 text-xl font-bold leading-tight text-[var(--color-title)]">{item.name}</h3><p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-muted)]">{item.description ?? "Oferta disponible en e-commerce."}</p><div className="mt-auto border-t border-[var(--color-border)] pt-5"><p className="text-sm text-[var(--color-text-muted)] line-through">Q{item.basePrice.toFixed(2)}</p><div className="mt-1 flex items-end justify-between gap-3"><div><p className="text-2xl font-bold text-[var(--color-title)]">Q{item.effectivePrice.toFixed(2)}</p><p className="mt-1 text-sm font-semibold text-[var(--color-success)]">Ahorras Q{item.discount.toFixed(2)}</p></div><Link className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-[var(--color-topbar)] transition hover:brightness-95" href={`/catalogo/${item.productId}`}>Ver</Link></div></div></article>)}</div></section> : null}
    </main>
  );
}
