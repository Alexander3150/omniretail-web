import Image from "next/image";
import Link from "next/link";
import type { StorefrontDiscoveryProductDto } from "@/modules/storefront/application/dto/StorefrontDiscoveryDto";

export function StorefrontProductCard({ product }: { product: StorefrontDiscoveryProductDto }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {product.imageUrl ? (
        <Image alt={product.imageAlt ?? product.name} className="h-48 w-full object-cover" height={192} src={product.imageUrl} width={384} />
      ) : (
        <div className="flex h-48 items-center justify-center bg-slate-100 text-sm text-[var(--color-text-muted)]">Sin imagen disponible</div>
      )}
      <div className="p-5">
        {product.categoryName ? <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">{product.categoryName}</p> : null}
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Código: {product.sku}</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{product.name}</h2>
        <p className="mt-2 min-h-10 text-sm text-[var(--color-text-muted)]">{product.description ?? "Sin descripción disponible."}</p>
        <p className="mt-5 text-xl font-bold text-[var(--color-title)]">Q{product.salePrice.toFixed(2)}</p>
        <Link className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]" href={`/catalogo/${product.id}`}>
          Ver producto
        </Link>
      </div>
    </article>
  );
}