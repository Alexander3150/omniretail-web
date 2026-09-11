"use client";

import Link from "next/link";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";

export function HomePage() {
  const { categories, products, loading, error } = useStorefrontDiscovery();
  return (
    <main>
      <section className="bg-[var(--color-topbar)] px-5 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">OmniRetail</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold md:text-5xl">Compra fácil, rápida y segura.</h1>
          <p className="mt-5 max-w-xl text-slate-300">Encuentra productos publicados, compara opciones y compra en línea.</p>
          <Link className="mt-7 inline-block rounded-md bg-[var(--color-primary)] px-5 py-3 font-semibold text-[var(--color-topbar)] hover:bg-[var(--color-primary-hover)]" href="/catalogo">Ver catálogo</Link>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex items-end justify-between gap-4"><h2 className="text-2xl font-bold text-[var(--color-title)]">Compra por categoría</h2><Link className="text-sm font-semibold text-[var(--color-primary)]" href="/catalogo">Ver todo</Link></div>
        {loading ? <p className="mt-5 text-[var(--color-text-muted)]">Cargando categorías...</p> : null}
        {error ? <p className="mt-5 text-[var(--color-danger)]">{error}</p> : null}
        {!loading && !error ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <Link key={category.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)]" href={`/catalogo?categoria=${category.id}`}>{category.name}</Link>)}</div> : null}
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-12">
        <h2 className="text-2xl font-bold text-[var(--color-title)]">Productos destacados</h2>
        {!loading && products.length > 0 ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.slice(0, 3).map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div> : null}
      </section>
    </main>
  );
}