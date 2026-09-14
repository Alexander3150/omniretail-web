"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StorefrontCatalogImage } from "@/modules/storefront/components/StorefrontCatalogImage";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";
import { useStorefrontOffers } from "@/modules/storefront/hooks/useStorefrontOffers";

const heroMessages = [
  {
    badge: "Mayoreo B2B",
    title: "Herramientas de alto rendimiento",
    description:
      "Equipamiento para contratistas, talleres y constructoras con productos confiables para cada proyecto.",
  },
  {
    badge: "Para tu proyecto",
    title: "Todo para construir con confianza",
    description: "Encuentra herramientas, fijaciones y suministros para cada etapa de tu obra.",
  },
  {
    badge: "Compra inteligente",
    title: "Calidad que impulsa tu trabajo",
    description:
      "Productos seleccionados para profesionales que buscan disponibilidad y rendimiento.",
  },
] as const;

export function HomePage() {
  const { categories, products, loading, error } = useStorefrontDiscovery();
  const { items: offers } = useStorefrontOffers();
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = useMemo(
    () =>
      heroMessages.map((message, index) => ({
        ...message,
        imageSource: products[index % Math.max(products.length, 1)]?.imageSource,
        imageAlt: products[index % Math.max(products.length, 1)]?.imageAlt,
      })),
    [products],
  );
  const slide = slides[activeSlide % Math.max(slides.length, 1)];
  const featuredProducts = useMemo(() => {
    const offerProductIds = new Set(offers.map((offer) => offer.productId));
    return [...products]
      .sort(
        (left, right) =>
          Number(offerProductIds.has(right.id)) - Number(offerProductIds.has(left.id)),
      )
      .slice(0, 3);
  }, [offers, products]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      9000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <main className="bg-[var(--color-app-background)]">
      <section className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        <div className="relative grid min-h-[26rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm lg:grid-cols-[1fr_.9fr] sm:min-h-[30rem]">
          <div className="relative z-10 flex flex-col justify-center px-7 py-14 sm:px-12">
            <p className="inline-flex w-fit rounded-md bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-title)]">
              {slide?.badge}
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight text-[var(--color-text)] sm:text-5xl">
              {slide?.title}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
              {slide?.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)] transition hover:bg-[var(--color-primary-hover)]"
                href="/catalogo"
              >
                Explorar catálogo →
              </Link>
              <Link
                className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-bold text-[var(--color-title)] transition hover:bg-slate-50"
                href="/ofertas"
              >
                Ver ofertas
              </Link>
            </div>
          </div>
          <div className="relative min-h-64 bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-surface)] p-6 lg:min-h-full">
            <StorefrontCatalogImage
              alt={slide?.imageAlt ?? "Producto de ferretería"}
              className="h-full min-h-64 w-full rounded-xl bg-white object-contain p-6 shadow-sm"
              source={slide?.imageSource}
            />
          </div>
          {slides.length > 1 ? (
            <div className="absolute bottom-5 left-7 z-20 flex gap-2 sm:left-12">
              {slides.map((item, index) => (
                <button
                  aria-label={`Ver diapositiva ${index + 1}`}
                  className={`h-2.5 rounded-full transition ${index === activeSlide ? "w-7 bg-[var(--color-primary-hover)]" : "w-2.5 bg-[var(--color-border)]"}`}
                  key={item.title}
                  onClick={() => setActiveSlide(index)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
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
          <div className="mt-8 grid grid-cols-2 gap-x-7 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {categories.map((category) => (
              <Link
                className="group mx-auto w-full max-w-40 text-center"
                href={`/catalogo?categoria=${category.id}`}
                key={category.id}
              >
                <StorefrontCatalogImage
                  alt={category.name}
                  className="aspect-square w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] object-cover p-3 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-[var(--color-primary)] group-hover:shadow-md"
                  source={category.imageSource}
                />
                <p className="mt-3 font-bold text-[var(--color-text)]">{category.name}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14">
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
        {!loading && featuredProducts.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <StorefrontProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
