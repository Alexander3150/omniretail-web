"use client";

import type { Category } from "@/core/entities";
import { SearchInput } from "@/shared/components/SearchInput";
import { Select } from "@/shared/components/Select";
import type { ProductFiltersState } from "@/modules/catalog/types/catalog.types";
import { productStatusOptions, productTypeOptions } from "@/modules/catalog/hooks/useProducts";
import { productTypeLabels } from "@/modules/catalog/components/productLabels";

interface ProductFiltersProps {
  filters: ProductFiltersState;
  categories: Category[];
  onChange: (filters: Partial<ProductFiltersState>) => void;
}

export function ProductFilters({ filters, categories, onChange }: ProductFiltersProps) {
  return (
    <section className="grid gap-3 rounded-md border border-[var(--color-border)] bg-white p-4 md:grid-cols-5">
      <SearchInput
        aria-label="Buscar productos"
        className="md:col-span-2"
        onChange={(event) => onChange({ search: event.target.value })}
        placeholder="Buscar por nombre, SKU, barcode o marca"
        value={filters.search}
      />
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
      <Select
        aria-label="Filtrar por canal"
        className="md:col-span-1"
        onChange={(event) =>
          onChange({ channel: event.target.value as ProductFiltersState["channel"] })
        }
        value={filters.channel}
      >
        <option value="all">Todos los canales</option>
        <option value="ecommerce">E-commerce</option>
        <option value="pos">POS</option>
      </Select>
    </section>
  );
}
