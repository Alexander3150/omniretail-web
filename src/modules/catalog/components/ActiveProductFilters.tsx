"use client";

import type { Category } from "@/core/entities";
import { ProductStatus, ProductType } from "@/core/enums";
import { productTypeLabels } from "@/modules/catalog/components/productLabels";
import type { ProductFiltersState } from "@/modules/catalog/types/catalog.types";

const channelLabels: Record<Exclude<ProductFiltersState["channel"], "all">, string> = {
  pos: "POS",
  ecommerce: "Web",
  mobileApp: "App",
};

interface ActiveProductFiltersProps {
  filters: ProductFiltersState;
  categories: Category[];
  onRemove: (filters: Partial<ProductFiltersState>) => void;
  onClear: () => void;
}

export function getActiveProductFiltersCount(filters: ProductFiltersState) {
  return [
    filters.status !== "all",
    filters.productType !== "all",
    filters.categoryId !== "all",
    filters.channel !== "all",
  ].filter(Boolean).length;
}

export function ActiveProductFilters({
  filters,
  categories,
  onRemove,
  onClear,
}: ActiveProductFiltersProps) {
  const chips = [
    filters.status !== "all"
      ? {
          key: "status",
          label: filters.status === ProductStatus.published ? "Publicado" : "Archivado",
          clear: () => onRemove({ status: "all" }),
        }
      : null,
    filters.productType !== "all"
      ? {
          key: "productType",
          label: productTypeLabels[filters.productType as ProductType],
          clear: () => onRemove({ productType: "all" }),
        }
      : null,
    filters.categoryId !== "all"
      ? {
          key: "category",
          label:
            categories.find((category) => category.id === filters.categoryId)?.name ?? "Categoría",
          clear: () => onRemove({ categoryId: "all" }),
        }
      : null,
    filters.channel !== "all"
      ? {
          key: "channel",
          label: channelLabels[filters.channel],
          clear: () => onRemove({ channel: "all" }),
        }
      : null,
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => Boolean(chip));

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
          key={chip.key}
          onClick={chip.clear}
          type="button"
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        className="text-xs font-semibold text-[var(--color-title)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
        onClick={onClear}
        type="button"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
