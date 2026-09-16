"use client";

import Image from "next/image";
import Link from "next/link";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeProduct, clearCart } = useStorefrontCart();
  const { products } = useStorefrontDiscovery();
  const availabilityByProductId = new Map(
    products.map((product) => [product.id, product.availableQuantity]),
  );
  const invalidItems = items.filter((item) => {
    const availableQuantity = availabilityByProductId.get(item.productId);
    return availableQuantity !== undefined && availableQuantity !== null && item.quantity > availableQuantity;
  });
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  if (items.length === 0)
    return (
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
        <section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
            Tu selección
          </p>
          <h1 className="mt-2 text-3xl font-black text-[var(--color-text)]">
            Tu carrito está vacío
          </h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            Explora el catálogo y agrega lo que necesitas.
          </p>
          <Link
            className="mt-6 inline-block rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]"
            href="/catalogo"
          >
            Ver catálogo
          </Link>
        </section>
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
            Tu selección
          </p>
          <h1 className="mt-2 text-4xl font-black text-[var(--color-text)]">Carrito</h1>
        </div>
        <button
          className="text-sm font-bold text-[var(--color-danger)] underline-offset-4 hover:underline"
          onClick={clearCart}
          type="button"
        >
          Vaciar carrito
        </button>
      </div>
      <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="hidden grid-cols-[minmax(14rem,1fr)_5rem_6rem_6rem_6rem_3rem] gap-3 border-b border-[var(--color-border)] bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-wider text-[var(--color-primary-hover)] xl:grid">
            <span>Producto</span>
            <span>SKU</span>
            <span className="text-center">Cantidad</span>
            <span className="text-right">Precio unit.</span>
            <span className="text-right">Total</span>
            <span className="text-right">Acción</span>
          </div>
          {items.map((item) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            const availableQuantity = availabilityByProductId.get(item.productId);
            const isInvalid =
              availableQuantity !== undefined &&
              availableQuantity !== null &&
              item.quantity > availableQuantity;
            return (
            <article
              key={item.productId}
              className="grid min-h-32 gap-3 border-b border-[var(--color-border)] px-4 py-5 last:border-b-0 sm:px-5 xl:grid-cols-[minmax(14rem,1fr)_5rem_6rem_6rem_6rem_3rem] xl:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                {item.imageUrl ? (
                  <Image
                    alt={item.imageAlt ?? item.name}
                    className="h-16 w-16 shrink-0 rounded-xl border border-[var(--color-border)] bg-slate-50 object-contain object-center p-1"
                    height={64}
                    src={item.imageUrl}
                    width={64}
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-slate-50 text-center text-xs text-[var(--color-text-muted)]">
                    Sin imagen
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="mt-1 truncate text-lg font-black text-[var(--color-text)]">
                    {item.name}
                  </h2>
                  {isInvalid ? (
                    <p className="mt-1 text-sm font-bold text-[var(--color-danger)]" role="alert">
                      {availableQuantity === 0
                        ? "Agotado. Retira este producto para continuar."
                        : `Solo hay ${availableQuantity} ${product?.saleUnitName ?? "unidades"} disponibles.`}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Producto disponible para compra en línea
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm font-mono text-[var(--color-text-muted)]">{item.sku}</p>
              <div className="flex items-center justify-between gap-4 md:block">
                <span className="text-sm font-bold text-[var(--color-text-muted)] md:hidden">
                  Cantidad
                </span>
                <div className="flex w-fit items-center rounded-xl border border-[var(--color-border)] bg-slate-50">
                  <button
                    aria-label={`Reducir cantidad de ${item.name}`}
                    className="px-4 py-2 font-black"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    type="button"
                  >
                    −
                  </button>
                  <span className="min-w-10 text-center font-bold">{item.quantity}</span>
                  <button
                    aria-label={`Aumentar cantidad de ${item.name}`}
                    className="px-4 py-2 font-black"
                    disabled={availableQuantity !== undefined && availableQuantity !== null && item.quantity >= availableQuantity}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="flex justify-between text-base font-bold text-[var(--color-text)] lg:block lg:text-right">
                <span className="text-sm font-bold text-[var(--color-text-muted)] lg:hidden">
                  Precio unitario
                </span>
                Q{item.unitPrice.toFixed(2)}
              </p>
              <p className="flex justify-between text-lg font-black text-[var(--color-text)] md:block md:text-right">
                <span className="text-sm font-bold text-[var(--color-text-muted)] md:hidden">
                  Total
                </span>
                Q{(item.unitPrice * item.quantity).toFixed(2)}
              </p>
              <button
                aria-label={`Quitar ${item.name}`}
                className="grid h-9 w-9 justify-self-end place-items-center rounded-full border border-[var(--color-danger)]/35 bg-red-50 text-xl font-black leading-none text-[var(--color-danger)] shadow-sm transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]/35"
                onClick={() => removeProduct(item.productId)}
                type="button"
              >
                ×
              </button>
            </article>
            );
          })}
        </div>
        <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <p className="text-xl font-black text-[var(--color-text)]">Resumen de compra</p>
          <div className="mt-5 space-y-4 border-y border-[var(--color-border)] py-4">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">
                Subtotal ({itemCount} {itemCount === 1 ? "producto" : "productos"})
              </span>
              <span className="font-bold text-[var(--color-text)]">Q{subtotal.toFixed(2)}</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Los descuentos por volumen se mostrarán cuando estén aplicados en el pedido.
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="font-black text-[var(--color-text)]">Total estimado</span>
            <span className="text-xl font-black text-[var(--color-text)]">
              Q{subtotal.toFixed(2)}
            </span>
          </div>
          {invalidItems.length > 0 ? (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-[var(--color-danger)]" role="alert">
              Corrige o retira los productos agotados antes de continuar al checkout.
            </p>
          ) : (
            <Link
              className="mt-6 block rounded-xl bg-[var(--color-primary-hover)] px-4 py-3 text-center font-black text-white transition hover:brightness-110"
              href="/checkout"
            >
              Continuar al checkout
            </Link>
          )}
          <Link
            className="mt-4 block text-center text-sm font-bold text-[var(--color-title)] hover:underline"
            href="/catalogo"
          >
            Seguir comprando
          </Link>
        </aside>
      </div>
    </main>
  );
}
