import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="mt-auto bg-[var(--color-topbar)] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm md:flex-row md:justify-between">
        <p>© 2026 OmniRetail</p>

        <div className="flex gap-4">
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/ofertas">Ofertas</Link>
          <Link href="/ayuda">Ayuda</Link>
        </div>
      </div>
    </footer>
  );
}
