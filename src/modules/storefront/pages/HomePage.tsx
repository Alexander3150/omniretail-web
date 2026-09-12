"use client";

import Link from "next/link";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";
import { useStorefrontOffers } from "@/modules/storefront/hooks/useStorefrontOffers";

export function HomePage() {
  const { categories, products, loading, error } = useStorefrontDiscovery();
  const { items: offers } = useStorefrontOffers();
  return (
    <main>
      <section className="overflow-hidden bg-[var(--color-topbar)] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-[1.05fr_.95fr] md:py-16">
          <div>
            <p className="inline-flex rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-[var(--color-topbar)]">
              Tienda en línea
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Encuentra lo que buscas.{" "}
              <span className="text-[var(--color-primary)]">Compra con confianza.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Productos publicados, ofertas activas y una experiencia de compra clara desde el
              catálogo hasta el seguimiento.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)] shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)]"
                href="/catalogo"
              >
                Explorar catálogo
              </Link>
              <Link
                className="rounded-xl border border-white/25 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                href="/ofertas"
              >
                Ver ofertas
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-6 text-sm">
              <div>
                <p className="font-black text-[var(--color-primary)]">01</p>
                <p className="mt-1 text-slate-300">Explora</p>
              </div>
              <div>
                <p className="font-black text-[var(--color-primary)]">02</p>
                <p className="mt-1 text-slate-300">Agrega al carrito</p>
              </div>
              <div>
                <p className="font-black text-[var(--color-primary)]">03</p>
                <p className="mt-1 text-slate-300">Sigue tu pedido</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />
            <div className="relative grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur sm:grid-cols-2">
              <div className="min-h-48 rounded-2xl bg-[var(--color-primary)] p-5 text-[var(--color-topbar)] sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-[.15em]">Compra inteligente</p>
                <p className="mt-8 max-w-xs text-2xl font-black leading-tight">
                  Descubre productos y promociones disponibles para ti.
                </p>
              </div>
              {categories.slice(0, 3).map((category, index) => (
                <Link
                  key={category.id}
                  href={`/catalogo?categoria=${category.id}`}
                  className={`rounded-2xl border border-white/10 p-5 transition hover:-translate-y-1 hover:bg-white/10 ${index === 2 ? "sm:col-span-2" : ""}`}
                >
                  <p className="text-xs font-black text-[var(--color-primary)]">CATEGORÍA</p>
                  <p className="mt-6 font-bold">{category.name}</p>
                  <p className="mt-1 text-sm text-slate-300">Explorar →</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 text-sm sm:grid-cols-3">
          <div>
            <p className="font-bold text-[var(--color-title)]">Productos publicados</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              Consulta opciones disponibles para compra en línea.
            </p>
          </div>
          <div>
            <p className="font-bold text-[var(--color-title)]">Ofertas vigentes</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              Los precios promocionales se muestran con claridad.
            </p>
          </div>
          <div>
            <p className="font-bold text-[var(--color-title)]">Seguimiento de pedido</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              Mantente al tanto del estado de tu compra.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
              Explora
            </p>
            <h2 className="mt-1 text-3xl font-black text-[var(--color-text)]">
              Compra por categoría
            </h2>
          </div>
          <Link className="text-sm font-bold text-[var(--color-title)]" href="/catalogo">
            Ver todo →
          </Link>
        </div>
        {loading ? (
          <p className="mt-6 text-[var(--color-text-muted)]">Cargando categorías...</p>
        ) : null}
        {error ? <p className="mt-6 text-[var(--color-danger)]">{error}</p> : null}
        {!loading && !error ? (
          <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-2">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                className="min-w-52 snap-start rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[var(--color-primary)]"
                href={`/catalogo?categoria=${category.id}`}
              >
                <span className="text-sm font-black text-[var(--color-primary-hover)]">
                  0{index + 1}
                </span>
                <p className="mt-6 text-lg font-bold text-[var(--color-text)]">{category.name}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Ver productos disponibles
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
      {offers.length > 0 ? (
        <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto max-w-7xl px-5 py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-success)]">
                  Precios especiales
                </p>
                <h2 className="mt-1 text-3xl font-black text-[var(--color-text)]">
                  Ofertas que no duran para siempre
                </h2>
              </div>
              <Link className="text-sm font-bold text-[var(--color-title)]" href="/ofertas">
                Todas las ofertas →
              </Link>
            </div>
            <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-3">
              {offers.slice(0, 5).map((offer) => (
                <Link
                  key={offer.productId}
                  className="min-w-64 snap-start rounded-2xl border border-[var(--color-border)] bg-[var(--color-app-background)] p-5 transition hover:-translate-y-1 hover:shadow-md"
                  href={`/catalogo/${offer.productId}`}
                >
                  <p className="inline-flex rounded-full bg-[var(--color-primary)]/15 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-title)]">
                    {offer.promotionName}
                  </p>
                  <p className="mt-5 font-bold text-[var(--color-text)]">{offer.name}</p>
                  <p className="mt-4 text-sm text-[var(--color-text-muted)] line-through">
                    Q{offer.basePrice.toFixed(2)}
                  </p>
                  <p className="text-2xl font-black text-[var(--color-title)]">
                    Q{offer.effectivePrice.toFixed(2)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--color-success)]">
                    Ahorras Q{offer.discount.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
              Selección para ti
            </p>
            <h2 className="mt-1 text-3xl font-black text-[var(--color-text)]">
              Productos destacados
            </h2>
          </div>
          <Link className="text-sm font-bold text-[var(--color-title)]" href="/catalogo">
            Ver catálogo →
          </Link>
        </div>
        {!loading && products.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <StorefrontProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
