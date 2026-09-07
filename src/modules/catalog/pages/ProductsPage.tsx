"use client";

import { useState } from "react";
import { ProductStatus } from "@/core/enums";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/Toast";
import {
  ActiveProductFilters,
  getActiveProductFiltersCount,
} from "@/modules/catalog/components/ActiveProductFilters";
import { ProductFilters } from "@/modules/catalog/components/ProductFilters";
import { ProductPriceHistoryDialog } from "@/modules/catalog/components/ProductPriceHistoryDialog";
import { ProductPromotionDialog } from "@/modules/catalog/components/ProductPromotionDialog";
import { ProductQuickView } from "@/modules/catalog/components/ProductQuickView";
import { ProductTable } from "@/modules/catalog/components/ProductTable";
import { ProductToolbar } from "@/modules/catalog/components/ProductToolbar";
import { useProductFormOptions } from "@/modules/catalog/hooks/useProductFormOptions";
import { useProductMutations } from "@/modules/catalog/hooks/useProductMutations";
import { useProducts } from "@/modules/catalog/hooks/useProducts";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";

export function ProductsPage() {
  const { showToast } = useToast();
  const {
    loading,
    error,
    products,
    filteredProducts,
    paginatedProducts,
    filters,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    updateFilters,
    clearFilters,
    clearAllFilters,
  } = useProducts();
  const { options } = useProductFormOptions();
  const mutations = useProductMutations();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<ProductListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProductListItem | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<ProductListItem | null>(null);
  const [priceHistoryTarget, setPriceHistoryTarget] = useState<ProductListItem | null>(null);
  const activeFiltersCount = getActiveProductFiltersCount(filters);
  const hasActiveFilters = activeFiltersCount > 0;
  const firstVisible = filteredProducts.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisible = Math.min(page * pageSize, filteredProducts.length);

  async function archiveProduct() {
    if (!archiveTarget) return;
    try {
      await mutations.archive(archiveTarget.id);
      showToast({ title: "Producto archivado", tone: "success" });
      setArchiveTarget(null);
    } catch (caughtError) {
      showToast({
        title: "No se pudo archivar",
        description: caughtError instanceof Error ? caughtError.message : undefined,
        tone: "danger",
      });
    }
  }

  const emptyMessage =
    products.length === 0
      ? "Aun no hay productos registrados."
      : "No hay productos que coincidan con los filtros.";

  return (
    <div className="space-y-5">
      <ProductToolbar
        activeFiltersCount={activeFiltersCount}
        filtersOpen={filtersOpen}
        onSearchChange={(search) => updateFilters({ search })}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        search={filters.search}
      />
      {filtersOpen ? (
        <ProductFilters
          categories={options?.categories ?? []}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          onChange={updateFilters}
          onClear={clearFilters}
        />
      ) : null}
      <ActiveProductFilters
        categories={options?.categories ?? []}
        filters={filters}
        onClear={clearFilters}
        onRemove={updateFilters}
      />
      {error ? (
        <p className="rounded-md border border-[var(--color-danger)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="rounded-md border border-[var(--color-border)] bg-white p-5 text-sm text-[var(--color-text-muted)]">
          Cargando productos...
        </p>
      ) : (
        <>
          <ProductTable
            emptyMessage={emptyMessage}
            footer={
              filteredProducts.length > 0 ? (
                <ProductTableFooter
                  firstVisible={firstVisible}
                  lastVisible={lastVisible}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  page={page}
                  pageSize={pageSize}
                  totalItems={filteredProducts.length}
                  totalPages={totalPages}
                />
              ) : null
            }
            onArchive={setArchiveTarget}
            onOpenQuickView={setQuickViewProduct}
            onPriceHistory={setPriceHistoryTarget}
            onPromotion={setPromotionTarget}
            products={paginatedProducts}
          />
          {products.length === 0 ? (
            <div className="flex justify-center">
              <Button href="/catalogo/productos/nuevo">Nuevo producto</Button>
            </div>
          ) : null}
          {products.length > 0 && filteredProducts.length === 0 ? (
            <div className="flex justify-center">
              <Button onClick={clearAllFilters} type="button">
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </>
      )}
      <ProductQuickView product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      <ProductPromotionDialog product={promotionTarget} onClose={() => setPromotionTarget(null)} />
      <ProductPriceHistoryDialog
        product={priceHistoryTarget}
        onClose={() => setPriceHistoryTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archivar producto"
        message="El producto dejara de estar disponible para nuevas operaciones, pero se conservara su historial."
        confirmLabel={archiveTarget?.status === ProductStatus.published ? "Archivar" : "Confirmar"}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={archiveProduct}
      />
    </div>
  );
}

function ProductTableFooter({
  firstVisible,
  lastVisible,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  firstVisible: number;
  lastVisible: number;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Mostrando {firstVisible}-{lastVisible} de {totalItems} productos
        </p>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Filas
          <Select
            aria-label="Filas por página"
            className="h-9 w-20 px-2"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </Select>
        </label>
      </div>
      <nav aria-label="Paginación de productos" className="flex items-center gap-3">
        <Button
          aria-label="Página anterior"
          className="min-h-9 px-3 py-1.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          &lt;
        </Button>
        <span className="min-w-12 text-center text-sm font-semibold text-[var(--color-text)]">
          {page} / {totalPages}
        </span>
        <Button
          aria-label="Página siguiente"
          className="min-h-9 px-3 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          &gt;
        </Button>
      </nav>
    </div>
  );
}
