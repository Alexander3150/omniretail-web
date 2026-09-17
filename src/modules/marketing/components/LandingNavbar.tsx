import Link from "next/link";
import { BrandMark } from "@/shared/components/BrandMark";

export default function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-app-background)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--color-title)]">
            <Link href="#funcionalidades" className="hover:text-[var(--color-primary)] transition-colors">
              Funcionalidades
            </Link>
            <Link href="#precios" className="hover:text-[var(--color-primary)] transition-colors">
              Precios
            </Link>
            <Link href="#faq" className="hover:text-[var(--color-primary)] transition-colors">
              Preguntas frecuentes
            </Link>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/iniciar-sesion"
            className="text-sm font-medium text-[var(--color-title)] hover:text-[var(--color-primary)] transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/contratar"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow transition-colors hover:bg-[var(--color-primary)]/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50"
          >
            Contratar MARJYM
          </Link>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center">
          <details className="group relative">
            <summary className="list-none cursor-pointer p-2">
              <svg className="w-6 h-6 text-[var(--color-title)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg ring-1 ring-black ring-opacity-5">
              <nav className="flex flex-col gap-4 text-sm font-medium text-[var(--color-title)]">
                <Link href="#funcionalidades" className="hover:text-[var(--color-primary)]">
                  Funcionalidades
                </Link>
                <Link href="#precios" className="hover:text-[var(--color-primary)]">
                  Precios
                </Link>
                <Link href="#faq" className="hover:text-[var(--color-primary)]">
                  Preguntas frecuentes
                </Link>
                <hr className="border-[var(--color-border)]" />
                <Link href="/iniciar-sesion" className="hover:text-[var(--color-primary)]">
                  Iniciar sesión
                </Link>
                <Link
                  href="/contratar"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow hover:bg-[var(--color-primary)]/90"
                >
                  Contratar MARJYM
                </Link>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
