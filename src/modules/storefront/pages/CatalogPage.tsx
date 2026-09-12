"use client";

import { useMemo, useSyncExternalStore } from "react";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";

export function CatalogPage() {
  const { categories, products, loading, error, reload } = useStorefrontDiscovery();
  const search = useCatalogSearchFilter();
  const selectedCategory = useCatalogCategoryFilter();
  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      const matchesSearch = !normalized || [product.name, product.sku, product.brand, product.description].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalized));
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);
  if (loading) return <main className="mx-auto max-w-7xl px-5 py-12"><p className="text-[var(--color-text-muted)]">Cargando catálogo...</p></main>;
  if (error) return <main className="mx-auto max-w-7xl px-5 py-12"><h1 className="text-3xl font-black text-[var(--color-text)]">Catálogo</h1><p className="mt-4 text-[var(--color-text-muted)]">{error}</p><button className="mt-5 rounded-xl bg-[var(--color-primary)] px-4 py-2 font-bold text-[var(--color-topbar)]" onClick={reload} type="button">Reintentar</button></main>;
  return <main className="mx-auto max-w-7xl px-5 py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-[var(--color-primary-hover)]">Tienda</p><h1 className="mt-2 text-4xl font-black text-[var(--color-text)]">Catálogo</h1><p className="mt-2 text-[var(--color-text-muted)]">Selecciona un producto para conocer más o agrégalo directamente a tu carrito.</p></div><p className="rounded-full bg-[var(--color-surface)] px-4 py-2 text-sm font-bold text-[var(--color-title)] shadow-sm">{filteredProducts.length} resultados</p></div><div className="mt-8 grid gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm md:grid-cols-[1fr_14rem]"><label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">Buscar productos<input className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-[var(--color-primary-hover)] focus:ring-4 focus:ring-[var(--color-primary)]/15" onChange={(event) => updateCatalogSearchFilter(event.target.value)} placeholder="Nombre, marca o código" value={search} /></label><label className="grid gap-2 text-sm font-bold text-[var(--color-text)]">Categoría<select className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 font-normal outline-none" onChange={(event) => updateCatalogCategoryFilter(event.target.value)} value={selectedCategory}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>{filteredProducts.length === 0 ? <section className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-muted)]">No hay productos que coincidan con tus filtros.</section> : <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>}</main>;
}
function useCatalogCategoryFilter() { return useSyncExternalStore((onStoreChange) => { window.addEventListener("popstate", onStoreChange); return () => window.removeEventListener("popstate", onStoreChange); }, () => new URLSearchParams(window.location.search).get("categoria") ?? "", () => ""); }
function useCatalogSearchFilter() { return useSyncExternalStore((onStoreChange) => { window.addEventListener("popstate", onStoreChange); return () => window.removeEventListener("popstate", onStoreChange); }, () => new URLSearchParams(window.location.search).get("q") ?? "", () => ""); }
function updateCatalogSearchFilter(search: string) { const url = new URL(window.location.href); if (search) url.searchParams.set("q", search); else url.searchParams.delete("q"); window.history.replaceState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }
function updateCatalogCategoryFilter(categoryId: string) { const url = new URL(window.location.href); if (categoryId) url.searchParams.set("categoria", categoryId); else url.searchParams.delete("categoria"); window.history.replaceState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }
