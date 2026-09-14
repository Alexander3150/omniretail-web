"use client";

import Link from "next/link";
import { useState } from "react";
import type { StorefrontDiscoveryProductDto } from "@/modules/storefront/application/dto/StorefrontDiscoveryDto";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";
import { StorefrontCatalogImage } from "@/modules/storefront/components/StorefrontCatalogImage";

export function StorefrontProductCard({
  product,
  compact = false,
}: {
  product: StorefrontDiscoveryProductDto;
  compact?: boolean;
}) {
  const { addProduct } = useStorefrontCart();
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const add = async () => {
    await addProduct(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };
  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--color-title)]/10">
      <button
        aria-expanded={expanded}
        className="block w-full text-left"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <div className="relative">
          <StorefrontCatalogImage
            alt={product.imageAlt ?? product.name}
            className={`${compact ? "h-40" : "h-48"} w-full bg-slate-50 object-cover transition duration-500 group-hover:scale-[1.03]`}
            source={product.imageSource}
          />
        </div>
        <div className={`${compact ? "p-4 pb-2" : "p-5 pb-3"}`}>
          {product.categoryName ? (
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
              {product.categoryName}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {product.brand ?? `Código · ${product.sku}`}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Código · {product.sku}</p>
          <h2 className="mt-2 text-lg font-bold text-[var(--color-text)]">{product.name}</h2>
          <p
            className={`mt-2 text-sm leading-5 text-[var(--color-text-muted)] ${expanded ? "" : "line-clamp-2"}`}
          >
            {product.description ?? "Sin descripción disponible."}
          </p>
        </div>
      </button>
      <div
        className={`flex items-end justify-between gap-3 ${compact ? "px-4 pb-4" : "px-5 pb-5"}`}
      >
        <p className="text-xl font-black text-[var(--color-title)]">
          Q{product.salePrice.toFixed(2)}
        </p>
        <button
          className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-bold text-[var(--color-topbar)] transition hover:bg-[var(--color-primary-hover)]"
          onClick={() => void add()}
          type="button"
        >
          {added ? "Agregado" : "Agregar"}
        </button>
      </div>
      {expanded ? (
        <div className="border-t border-[var(--color-border)] bg-slate-50 px-5 py-3">
          <Link
            className="text-sm font-bold text-[var(--color-title)] underline-offset-4 hover:underline"
            href={`/catalogo/${product.id}`}
          >
            Ver ficha completa →
          </Link>
        </div>
      ) : null}
    </article>
  );
}
