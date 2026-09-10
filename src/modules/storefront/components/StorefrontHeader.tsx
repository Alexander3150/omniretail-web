import Link from "next/link";

export function StorefrontHeader() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link className="text-xl font-bold text-[var(--color-title)]" href="/">
          OmniRetail
        </Link>

        <nav className="flex gap-4 text-sm font-medium text-[var(--color-text)]">
          <Link href="/catalogo">Catálogo</Link>
        </nav>
      </div>
    </header>
  );
}
