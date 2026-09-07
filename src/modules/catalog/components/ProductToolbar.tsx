"use client";

import { Button } from "@/shared/components/Button";
import { SearchInput } from "@/shared/components/SearchInput";
import { FilterIcon, PlusIcon } from "@/modules/catalog/components/CatalogIcons";

interface ProductToolbarProps {
  search: string;
  filtersOpen: boolean;
  activeFiltersCount: number;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
}

export function ProductToolbar({
  search,
  filtersOpen,
  activeFiltersCount,
  onSearchChange,
  onToggleFilters,
}: ProductToolbarProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          CATÁLOGO
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--color-title)]">Catálogo y precios</h1>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          aria-label="Buscar productos"
          className="w-full md:w-96"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, SKU, marca o código de barras"
          value={search}
        />
        <Button
          aria-controls="product-filters-panel"
          aria-expanded={filtersOpen}
          onClick={onToggleFilters}
          type="button"
          variant="secondary"
        >
          <FilterIcon />
          Filtros
          {activeFiltersCount ? (
            <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white">
              {activeFiltersCount}
            </span>
          ) : null}
        </Button>
        <Button href="/catalogo/productos/nuevo">
          <PlusIcon />
          Nuevo producto
        </Button>
      </div>
    </header>
  );
}
