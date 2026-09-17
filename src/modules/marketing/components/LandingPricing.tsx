import Link from "next/link";
import { BASE_MONTHLY_QUETZALES, SUBSCRIPTION_ADDONS } from "@/core/subscription/catalog";

export default function LandingPricing() {
  const baseFeatures = [
    "Inventario",
    "Compras",
    "Recepciones",
    "Punto de Venta",
    "Lotes",
    "Vencimientos",
    "Números de serie",
  ];

  return (
    <section id="precios" className="py-16 md:py-24 bg-[var(--color-app-background)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-title)] mb-4">
            Precios simples y transparentes
          </h2>
          <p className="text-lg text-[var(--color-title)]/70">
            Comienza con la base sólida que tu negocio necesita y agrega funciones según tu crecimiento.
          </p>
        </div>

        <div className="mx-auto max-w-lg lg:max-w-none lg:flex lg:justify-center gap-8 items-stretch">
          {/* Base Plan */}
          <div className="flex flex-col bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-sm p-8 lg:w-[400px]">
            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-[var(--color-title)] mb-2">MARJYM Base</h3>
              <p className="text-[var(--color-title)]/70 text-sm mb-6">La solución integral para la gestión comercial y operativa diaria.</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-[var(--color-title)] tracking-tight">Q{BASE_MONTHLY_QUETZALES}</span>
                <span className="text-[var(--color-title)]/60 font-medium">/ mes</span>
              </div>
            </div>
            <ul className="flex-1 space-y-4 mb-8">
              {baseFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[var(--color-title)]/80">
                  <svg className="w-5 h-5 text-[var(--color-primary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/contratar"
              className="w-full inline-flex h-12 items-center justify-center rounded-lg bg-[var(--color-primary)] px-8 text-base font-semibold text-white shadow transition-colors hover:bg-[var(--color-primary)]/90"
            >
              Contratar MARJYM
            </Link>
          </div>

          {/* Addons Section */}
          <div className="mt-8 lg:mt-0 lg:w-[450px] flex flex-col justify-center gap-6">
            <h3 className="text-xl font-bold text-[var(--color-title)] px-2">
              Complementos adicionales
            </h3>
            <p className="text-[var(--color-title)]/70 text-sm px-2 mb-2">
              Estos módulos pueden agregarse a tu plan Base en cualquier momento.
            </p>

            {SUBSCRIPTION_ADDONS.map((addon) => (
              <div key={addon.code} className="bg-[var(--color-app-background)] rounded-2xl border border-[var(--color-border)] p-6 hover:border-[var(--color-primary)]/30 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-[var(--color-title)]">{addon.name}</h4>
                  <div className="text-right">
                    <span className="font-bold text-[var(--color-title)]">Q{addon.monthlyQuetzales}</span>
                    <span className="text-[var(--color-title)]/60 text-sm"> / mes</span>
                  </div>
                </div>
                {addon.code === "ecommerce_delivery" ? (
                  <p className="text-sm text-[var(--color-title)]/70">
                    Incluye catálogo en línea, carrito de compras, portal para clientes y seguimiento de pedidos.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-title)]/70">
                    {addon.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
