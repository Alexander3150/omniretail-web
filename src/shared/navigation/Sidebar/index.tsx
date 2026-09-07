import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-[var(--color-border)] bg-[var(--color-structure)] px-4 py-5 text-white">
      <nav aria-label="Navegacion principal">
        <Link
          className="block rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-white/15"
          href="/inicio"
        >
          Inicio
        </Link>
      </nav>
    </aside>
  );
}
