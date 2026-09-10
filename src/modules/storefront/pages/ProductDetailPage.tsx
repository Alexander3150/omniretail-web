"use client";

import Link from "next/link";
import { StorefrontAvailability } from "@/modules/storefront/components/StorefrontAvailability";
import { useStorefrontProductDetail } from "@/modules/storefront/hooks/useStorefrontProductDetail";

export function ProductDetailPage({ productId }: { productId: string }) {
  const { data, loading, error, reload } = useStorefrontProductDetail(productId);

  if (loading) {
    return <main className="mx-auto max-w-4xl px-5 py-10">Cargando producto...</main>;
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Producto</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">
          {error ?? "El producto no está disponible."}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
            onClick={reload}
            type="button"
          >
            Reintentar
          </button>
          <Link className="rounded-md border border-[var(--color-border)] px-4 py-2 font-semibold" href="/catalogo">
            Volver al catálogo
          </Link>
        </div>
      </main>
    );
  }

  const { product, availability } = data;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link className="text-sm font-semibold text-[var(--color-primary)]" href="/catalogo">
        ← Volver al catálogo
      </Link>

      <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">Código: {product.sku}</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">{product.name}</h1>
        {product.brand ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Marca: {product.brand}</p>
        ) : null}
        <p className="mt-5 text-[var(--color-text-muted)]">
          {product.description ?? "Sin descripción disponible."}
        </p>
        <p className="mt-6 text-2xl font-bold text-[var(--color-title)]">
          Q{product.salePrice.toFixed(2)}
        </p>
      </section>

      <StorefrontAvailability branches={availability} />
    </main>
  );
}
