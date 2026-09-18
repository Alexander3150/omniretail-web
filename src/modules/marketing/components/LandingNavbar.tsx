import Link from "next/link";

const links = [
  ["Inicio", "/"],
  ["Funcionalidades", "/#funcionalidades"],
  ["Módulos", "/#modulos"],
  ["Cómo funciona", "/#como-funciona"],
  ["Precios", "/#precios"],
  ["FAQ", "/#faq"],
] as const;

export default function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(157,184,255,.3)] bg-[rgba(255,244,214,.9)] py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-6">
        <Link className="flex items-center gap-3 text-[1.4rem] font-extrabold tracking-[-.02em] text-[var(--mkt-primary)]" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--mkt-accent)] text-lg font-bold text-white shadow-[0_4px_10px_rgba(47,103,231,.3)]">M</span>
          MARJYM
        </Link>
        <nav className="hidden items-center gap-9 lg:flex">
          {links.map(([label, href]) => <Link className="text-[.95rem] font-semibold text-[var(--mkt-primary)] transition hover:text-[var(--mkt-accent)]" href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link className="px-2 py-3 text-sm font-semibold text-[var(--mkt-primary)] hover:text-[var(--mkt-accent)]" href="/iniciar-sesion">Iniciar sesión</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md bg-[var(--mkt-accent)] px-6 text-sm font-semibold text-white shadow-[0_4px_6px_rgba(47,103,231,.25)] transition hover:-translate-y-px hover:bg-[var(--mkt-accent-hover)]" href="/contratar">Contratar MARJYM</Link>
        </div>
        <details className="group relative md:hidden">
          <summary aria-label="Abrir navegación" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-[var(--mkt-border)] text-[var(--mkt-primary)]">☰</summary>
          <nav className="absolute right-0 top-14 flex w-60 flex-col gap-1 rounded-xl border border-[var(--mkt-border-light)] bg-white p-3 shadow-lg">
            {links.map(([label, href]) => <Link className="rounded-md px-3 py-2 text-sm font-semibold text-[var(--mkt-primary)] hover:bg-[var(--mkt-accent-light)]" href={href} key={href}>{label}</Link>)}
            <hr className="my-1 border-[var(--mkt-border-light)]" />
            <Link className="rounded-md px-3 py-2 text-sm font-semibold text-[var(--mkt-primary)]" href="/iniciar-sesion">Iniciar sesión</Link>
            <Link className="rounded-md bg-[var(--mkt-accent)] px-3 py-2 text-center text-sm font-semibold text-white" href="/contratar">Contratar MARJYM</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
