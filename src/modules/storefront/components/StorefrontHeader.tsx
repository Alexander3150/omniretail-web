"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UserType } from "@/core/enums";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useStorefrontCart } from "@/modules/storefront/providers/StorefrontCartProvider";

export function StorefrontHeader() {
  const { itemCount } = useStorefrontCart();
  const { user, loading } = useCurrentSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/catalogo?q=${encodeURIComponent(query)}` : "/catalogo");
  };
  const isCustomer = user?.type === UserType.customer;
  const accountHref = !loading && user ? (isCustomer ? "/cuenta" : "/inicio") : "/iniciar-sesion";
  const accountLabel = !loading && user ? (isCustomer ? "Mi Cuenta" : "Ir a inicio") : "Ingresar";

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-topbar)] text-white shadow-lg shadow-slate-900/10">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-xs font-medium text-slate-300 sm:px-5">
          <span>Compra en línea</span>
          <span className="hidden sm:inline">
            Productos, ofertas y seguimiento en un mismo lugar
          </span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <Link
          className="flex shrink-0 items-center gap-2 text-lg font-black tracking-tight sm:text-xl"
          href="/"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-primary)] text-xs text-[var(--color-topbar)] shadow-sm">
            OR
          </span>
          <span className="hidden min-[390px]:inline">OmniRetail</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 lg:order-4">
          <Link
            className="rounded-lg bg-white/10 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 sm:px-3"
            href="/carrito"
          >
            Carrito{" "}
            <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-xs text-[var(--color-topbar)]">
              {itemCount}
            </span>
          </Link>
          <Link
            aria-label={accountLabel}
            className="rounded-lg px-2.5 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:px-3"
            href={accountHref}
          >
            <svg
              aria-hidden="true"
              className="inline-block h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.2-6 8-6s6.5 2 8 6" />
            </svg>
            <span className="ml-1 hidden min-[1180px]:inline">{accountLabel}</span>
          </Link>
        </div>
        <form
          className="order-3 basis-full lg:order-2 lg:min-w-48 lg:flex-1"
          onSubmit={submitSearch}
        >
          <label className="sr-only" htmlFor="storefront-search">
            Buscar productos
          </label>
          <div className="relative mx-auto max-w-xl">
            <input
              className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-4 pr-12 text-sm text-white outline-none placeholder:text-slate-300 transition focus:border-[var(--color-primary)] focus:bg-white/15 focus:ring-2 focus:ring-[var(--color-primary)]/30"
              id="storefront-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar productos, marcas o códigos"
              value={search}
            />
            <button
              aria-label="Buscar productos"
              className="absolute inset-y-1 right-1 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-black text-[var(--color-topbar)] transition hover:bg-[var(--color-primary-hover)]"
              type="submit"
            >
              ⌕
            </button>
          </div>
        </form>
        <nav
          aria-label="Navegación principal"
          className="order-4 flex w-full items-center justify-between border-t border-white/10 pt-3 text-sm font-semibold lg:order-3 lg:w-auto lg:justify-start lg:border-0 lg:pt-0"
        >
          <Link
            className="rounded-lg px-2.5 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:px-3"
            href="/catalogo"
          >
            Catálogo
          </Link>
          <Link
            className="rounded-lg px-2.5 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:px-3"
            href="/ofertas"
          >
            Ofertas
          </Link>
          <Link
            className="rounded-lg px-2.5 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white sm:px-3"
            href="/ayuda"
          >
            Ayuda
          </Link>
        </nav>
      </div>
    </header>
  );
}
