import Link from "next/link";

export function HomePage() {
  return (
    <main>
      <section className="bg-[var(--color-topbar)] px-5 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">
            OmniRetail
          </p>

          <h1 className="mt-3 max-w-2xl text-4xl font-bold md:text-5xl">
            Compra fácil, rápida y segura.
          </h1>

          <p className="mt-5 max-w-xl text-slate-300">
            Explora productos, revisa promociones y recibe seguimiento de tu pedido.
          </p>

          <Link
            className="mt-7 inline-block rounded-md bg-[var(--color-primary)] px-5 py-3 font-semibold text-[var(--color-topbar)] hover:bg-[var(--color-primary-hover)]"
            href="/catalogo"
          >
            Ver catálogo
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <h2 className="text-2xl font-bold text-[var(--color-title)]">
          Compra por categoría
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Herramientas", "Ferretería", "Farmacia", "Servicios"].map((category) => (
            <Link
              key={category}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)]"
              href="/catalogo"
            >
              {category}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}