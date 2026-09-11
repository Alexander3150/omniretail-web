"use client";

import { useEffect, useMemo, useState } from "react";
import { StorefrontProductCard } from "@/modules/storefront/components/StorefrontProductCard";
import { useStorefrontDiscovery } from "@/modules/storefront/hooks/useStorefrontDiscovery";

export function CatalogPage() {
  const { categories, products, loading, error, reload } = useStorefrontDiscovery();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    setSelectedCategory(new URLSearchParams(window.location.search).get("categoria") ?? "");
  }, []);
  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      const matchesSearch = !normalized || [product.name, product.sku, product.brand, product.description].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalized));
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  if (loading) return <main className="mx-auto max-w-7xl px-5 py-10"><p>Cargando catálogo...</p></main>;
  if (error) return <main className="mx-auto max-w-7xl px-5 py-10"><h1 className="text-3xl font-bold text-[var(--color-text)]">Catálogo</h1><p className="mt-4 text-[var(--color-text-muted)]">{error}</p><button className="mt-5 rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-topbar)]" onClick={reload} type="button">Reintentar</button></main>;

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-semibold text-[var(--color-title)]">Tienda</p><h1 className="mt-1 text-3xl font-bold text-[var(--color-text)]">Catálogo</h1>
      <div className="mt-6 grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold text-[var(--color-text)]">Buscar productos<input className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 font-normal" onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, marca o código" value={search} /></label>
        <label className="grid gap-1 text-sm font-semibold text-[var(--color-text)]">Categoría<select className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 font-normal" onChange={(event) => setSelectedCategory(event.target.value)} value={selectedCategory}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>
      <p className="mt-5 text-sm text-[var(--color-text-muted)]">{filteredProducts.length} producto(s) encontrado(s)</p>
      {filteredProducts.length === 0 ? <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-muted)]">No hay productos que coincidan con los filtros seleccionados.</p> : <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>}
    </main>
  );
}