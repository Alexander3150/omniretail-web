import Link from "next/link";
import { BrandMark } from "@/shared/components/BrandMark";

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-app-background)] border-t border-[var(--color-border)] py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/" className="inline-block">
              <BrandMark size="md" />
            </Link>
            <p className="text-[var(--color-title)]/60 text-sm text-center md:text-left max-w-xs">
              Todo tu negocio, en un solo lugar. Gestión de inventario, ventas y compras para tu comercio.
            </p>
          </div>

          <nav className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-4 text-sm font-medium text-[var(--color-title)]/80">
            <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">
              Inicio
            </Link>
            <Link href="#funcionalidades" className="hover:text-[var(--color-primary)] transition-colors">
              Funcionalidades
            </Link>
            <Link href="#precios" className="hover:text-[var(--color-primary)] transition-colors">
              Precios
            </Link>
            <Link href="#faq" className="hover:text-[var(--color-primary)] transition-colors">
              FAQ
            </Link>
            <Link href="/iniciar-sesion" className="hover:text-[var(--color-primary)] transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/contratar" className="hover:text-[var(--color-primary)] transition-colors">
              Contratar
            </Link>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--color-border)] text-center md:flex md:justify-between md:items-center md:text-left">
          <p className="text-sm text-[var(--color-title)]/50">
            &copy; {currentYear} MARJYM. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
