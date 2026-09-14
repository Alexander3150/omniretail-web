"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";
import { useStorefrontOffers } from "@/modules/storefront/hooks/useStorefrontOffers";

const hardwareHeroMessages = [
  {
    badge: "Mayoreo B2B",
    title: "Herramientas de alto rendimiento",
    description:
      "Equipamiento industrial para contratistas, talleres y constructoras con precios escalonados por volumen.",
  },
  {
    badge: "Para tu proyecto",
    title: "Todo para construir con confianza",
    description: "Encuentra herramientas, fijación y suministros para cada etapa de tu obra.",
  },
  {
    badge: "Compra inteligente",
    title: "Calidad que impulsa tu trabajo",
    description:
      "Productos seleccionados para profesionales que buscan disponibilidad y rendimiento.",
  },
] as const;

const hardwareCategories = [
  { name: "Herramientas eléctricas", search: "herramientas eléctricas" },
  { name: "Herramientas manuales", search: "herramientas manuales" },
  { name: "Tornillos y fijación", search: "tornillos fijación" },
  { name: "Pinturas y acabados", search: "pintura acabados" },
  { name: "Seguridad industrial", search: "seguridad industrial" },
  { name: "Plomería", search: "plomería" },
  { name: "Electricidad", search: "electricidad" },
  { name: "Materiales de construcción", search: "construcción" },
] as const;

export function HomePage() {
  const { categories, products, loading, error } = useStorefrontDiscovery();
  const { items: offers } = useStorefrontOffers();
  const hardwareImages = useMemo(
    () =>
      products
        .filter(
          (product) =>
            product.imageUrl &&
            /herramient|ferreter|construcc|fijaci/i.test(
              `${product.categoryName ?? ""} ${product.name}`,
            ),
        )
        .slice(0, 3),
    [products],
  );
  const slides = useMemo(
    () =>
      hardwareHeroMessages.map((message, index) => {
        const image = hardwareImages[index % Math.max(hardwareImages.length, 1)];
        return { ...message, imageUrl: image?.imageUrl, imageAlt: image?.imageAlt };
      }),
    [hardwareImages],
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = slides[activeSlide % Math.max(slides.length, 1)];
  const featuredProducts = useMemo(() => {
    const offersByProductId = new Map(offers.map((offer) => [offer.productId, offer]));
    return [...products]
      .sort(
        (left, right) =>
          Number(offersByProductId.has(right.id)) - Number(offersByProductId.has(left.id)),
      )
      .slice(0, 3)
      .map((product) => ({ product, offer: offersByProductId.get(product.id) }));
  }, [offers, products]);
  const categoryHref = (name: string, search: string) => {
    const configuredCategory = categories.find(
      (category) => category.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    );
    return configuredCategory
      ? `/catalogo?categoria=${configuredCategory.id}`
      : `/catalogo?q=${encodeURIComponent(search)}`;
  };

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      9000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const showPreviousSlide = () =>
    setActiveSlide((current) => (current - 1 + slides.length) % slides.length);
  const showNextSlide = () => setActiveSlide((current) => (current + 1) % slides.length);
  return (
    <main>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        <div className="relative min-h-[26rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm sm:min-h-[30rem]">
          {slide?.imageUrl ? (
            <>
              <div className="absolute inset-y-0 right-0 z-10 w-full bg-gradient-to-r from-white via-white/90 to-white/10 sm:w-3/4" />
              <Image
                alt={slide.imageAlt ?? "Imagen promocional de ferretería"}
                className="absolute inset-0 z-0 h-full w-full object-contain object-right p-5 sm:p-8"
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
                src={slide.imageUrl!}
              />
              <div className="relative z-20 flex min-h-[26rem] max-w-xl flex-col justify-center px-7 py-14 sm:min-h-[30rem] sm:px-12">
                <p className="inline-flex w-fit rounded-md bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-title)]">
                  {slide.badge}
                </p>
                <h1 className="mt-5 text-4xl font-black leading-tight text-[var(--color-text)] sm:text-5xl">
                  {slide.title}
                </h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
                  {slide.description}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)] transition hover:bg-[var(--color-primary-hover)]"
                    href="/catalogo"
                  >
                    Explorar catálogo →
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[26rem] flex-col justify-center px-7 sm:min-h-[30rem] sm:px-12">
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary-hover)]">
                Ferretería profesional
              </p>
              <h1 className="mt-4 text-4xl font-black text-[var(--color-text)] sm:text-5xl">
                Herramientas de alto rendimiento
              </h1>
              <Link
                className="mt-7 w-fit rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-[var(--color-topbar)]"
                href="/catalogo"
              >
                Explorar catálogo
              </Link>
            </div>
          )}
          {slides.length > 1 ? (
            <>
              <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
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
              <div className="absolute bottom-5 right-5 z-20 flex gap-2">
                <button
                  aria-label="Diapositiva anterior"
                  className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-primary-hover)] bg-white/90 text-2xl text-[var(--color-title)] transition hover:bg-[var(--color-primary)]"
                  onClick={showPreviousSlide}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Diapositiva siguiente"
                  className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-primary-hover)] bg-white/90 text-2xl text-[var(--color-title)] transition hover:bg-[var(--color-primary)]"
                  onClick={showNextSlide}
                  type="button"
                >
                  ›
                </button>
              </div>
            </>
          ) : null}
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
          <div className="mt-8 grid grid-cols-2 gap-x-7 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {hardwareCategories.map((category) => (
              <Link
                key={category.name}
                className="group mx-auto w-full max-w-40 text-center"
                href={categoryHref(category.name, category.search)}
              >
                <span className="relative grid aspect-square place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/20 via-[var(--color-surface)] to-[var(--color-primary)]/5 p-5 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-[var(--color-primary)] group-hover:shadow-md">
                  <span className="sr-only">Imagen de {category.name}</span>
                </span>
                <p className="mt-3 font-bold text-[var(--color-text)]">{category.name}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
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
        {!loading && featuredProducts.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map(({ product, offer }) => (
              <StorefrontProductCard
                key={product.id}
                offer={
                  offer
                    ? { originalPrice: offer.basePrice, promotionName: offer.promotionName }
                    : undefined
                }
                product={{ ...product, salePrice: offer?.effectivePrice ?? product.salePrice }}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
