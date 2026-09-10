"use client";

import Link from "next/link";
import { useStorefrontCatalog } from "@/modules/storefront/hooks/useStorefrontCatalog";

export function CatalogPage() {
  const { items, loading } = useStorefrontCatalog();

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <p>Cargando catálogo...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-semibold text-[var(--color-title)]">Tienda</p>

      <h1 className="mt-1 text-3xl font-bold text-[var(--color-text)]">
        Catálogo
      </h1>

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

            <Link
              className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
              href={`/catalogo/${product.id}`}
            >
              Ver detalle
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}