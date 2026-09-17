import Link from "next/link";

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-app-background)] pt-16 md:pt-24 lg:pt-32 pb-16 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm md:text-base font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-4">
            Gestión comercial para negocios que quieren crecer
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[var(--color-title)] mb-6 leading-tight">
            Todo tu negocio, en un solo lugar.
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-title)]/70 mb-10 leading-relaxed">
            Centraliza tu <strong className="font-semibold text-[var(--color-title)]">inventario</strong>,{" "}
            <strong className="font-semibold text-[var(--color-title)]">compras</strong>, y{" "}
            <strong className="font-semibold text-[var(--color-title)]">ventas</strong>.
            Toma el control operativo con nuestro ágil <strong className="font-semibold text-[var(--color-title)]">punto de venta</strong> diseñado para facilitarte la vida.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contratar"
              className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-lg bg-[var(--color-primary)] px-8 text-base font-semibold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[var(--color-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              Contratar MARJYM
            </Link>
            <Link
              href="/iniciar-sesion"
              className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-8 text-base font-semibold text-[var(--color-title)] shadow-sm transition-colors hover:bg-[var(--color-border)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              Iniciar sesión
            </Link>
          </div>

          <div className="mt-8">
            <Link
              href="/tienda/ferrepharma-demo"
              className="text-sm font-medium text-[var(--color-title)]/60 hover:text-[var(--color-title)] hover:underline transition-colors"
            >
              Ver tienda demo
            </Link>
          </div>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-full pointer-events-none opacity-20 -z-0">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[var(--color-structure)] to-[var(--color-primary)] blur-3xl" />
      </div>
    </section>
  );
}
