"use client";

import Link from "next/link";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeProduct, clearCart } = useStorefrontCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Carrito</h1>
        <p className="mt-4 text-[var(--color-text-muted)]">Tu carrito está vacío.</p>
        <Link
          className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]"
          href="/catalogo"
        >
          Ver catálogo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Carrito</h1>
        <button
          className="text-sm font-semibold text-[var(--color-primary)]"
          onClick={clearCart}
          type="button"
        >
          Vaciar carrito
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <article
            key={item.productId}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">Código: {item.sku}</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{item.name}</h2>
                <p className="mt-2 font-bold text-[var(--color-title)]">Q{item.unitPrice.toFixed(2)}</p>
              </div>
              <button
                className="text-sm font-semibold text-[var(--color-primary)]"
                onClick={() => removeProduct(item.productId)}
                type="button"
              >
                Quitar
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                aria-label={`Reducir cantidad de ${item.name}`}
                className="rounded-md border border-[var(--color-border)] px-3 py-1 font-bold"
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                type="button"
              >
                −
              </button>
              <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
              <button
                aria-label={`Aumentar cantidad de ${item.name}`}
                className="rounded-md border border-[var(--color-border)] px-3 py-1 font-bold"
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                type="button"
              >
                +
              </button>
              <p className="ml-auto font-semibold text-[var(--color-text)]">
                Q{(item.unitPrice * item.quantity).toFixed(2)}
              </p>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-[var(--color-text)]">Subtotal</h2>
          <p className="text-2xl font-bold text-[var(--color-title)]">Q{subtotal.toFixed(2)}</p>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          El checkout estará disponible en el siguiente módulo.
        </p>
      </section>
    </main>
  );
}
