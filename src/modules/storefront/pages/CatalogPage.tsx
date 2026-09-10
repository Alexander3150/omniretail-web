"use client";

import { useStorefrontCatalog } from "@/modules/storefront/hooks/useStorefrontCatalog";

export function CatalogPage() {
  const { items, loading, error, reload } = useStorefrontCatalog();

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <p>Cargando catálogo...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Catálogo</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">{error}</p>
        <button
          className="mt-5 rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
          onClick={reload}
          type="button"
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-semibold text-[var(--color-title)]">Tienda</p>

      <h1 className="mt-1 text-3xl font-bold text-[var(--color-text)]">
        Catálogo
      </h1>

      {items.length === 0 ? (
        <p className="mt-7 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-muted)]">
          No hay productos disponibles en este momento.
        </p>
      ) : (
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <article
            key={product.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <p className="text-sm text-[var(--color-text-muted)]">
              Código: {product.sku}
            </p>

            <h2 className="mt-2 text-lg font-semibold text-[var(--color-text)]">
              {product.name}
            </h2>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {product.description ?? "Sin descripción disponible."}
            </p>

            <p className="mt-5 text-xl font-bold text-[var(--color-title)]">
              Q{product.salePrice.toFixed(2)}
            </p>

            <p className="mt-5 text-sm font-medium text-[var(--color-text-muted)]">
              Detalle del producto próximamente.
            </p>
          </article>
        ))}
      </div>
      )}
    </main>
  );
}
