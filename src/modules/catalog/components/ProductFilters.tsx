"use client";

import type { Category } from "@/core/entities";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { productTypeLabels } from "@/modules/catalog/components/productLabels";
import { productStatusOptions, productTypeOptions } from "@/modules/catalog/hooks/useProducts";
import type { ProductFiltersState } from "@/modules/catalog/types/catalog.types";

interface ProductFiltersProps {
  filters: ProductFiltersState;
  categories: Category[];
  onChange: (filters: Partial<ProductFiltersState>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export function ProductFilters({
  filters,
  categories,
  onChange,
  onClear,
  hasActiveFilters,
}: ProductFiltersProps) {
  return (
    <section
      className="grid gap-3 rounded-md border border-[var(--color-border)] bg-white p-4 md:grid-cols-4"
      id="product-filters-panel"
    >
      <Select
        aria-label="Filtrar por estado"
        onChange={(event) =>
          onChange({ status: event.target.value as ProductFiltersState["status"] })
        }
        value={filters.status}
      >
        <option value="all">Todos los estados</option>
        {productStatusOptions.map((status) => (
          <option key={status} value={status}>
            {status === "published" ? "Publicado" : "Archivado"}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrar por tipo"
        onChange={(event) =>
          onChange({ productType: event.target.value as ProductFiltersState["productType"] })
        }
        value={filters.productType}
      >
        <option value="all">Todos los tipos</option>
        {productTypeOptions.map((type) => (
          <option key={type} value={type}>
            {productTypeLabels[type]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrar por categoria"
        onChange={(event) => onChange({ categoryId: event.target.value })}
        value={filters.categoryId}
      >
        <option value="all">Todas las categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Select
          aria-label="Filtrar por canal"
          onChange={(event) =>
            onChange({ channel: event.target.value as ProductFiltersState["channel"] })
          }
          value={filters.channel}
        >
          <option value="all">Todos los canales</option>
          <option value="ecommerce">Web</option>
          <option value="pos">POS</option>
        </Select>
        {hasActiveFilters ? (
          <Button className="min-h-10 whitespace-nowrap px-3 py-2" onClick={onClear} type="button">
            Limpiar
          </Button>
        ) : null}
      </div>
    </section>
  );
}
