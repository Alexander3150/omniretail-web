"use client";

import { useState } from "react";
import { ProductStatus } from "@/core/enums";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PageHeader } from "@/shared/components/PageHeader";
import { Pagination } from "@/shared/components/Pagination";
import { useToast } from "@/shared/components/Toast";
import { ProductFilters } from "@/modules/catalog/components/ProductFilters";
import { ProductTable } from "@/modules/catalog/components/ProductTable";
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
    totalPages,
    setPage,
    updateFilters,
    reload,
  } = useProducts();
  const { options } = useProductFormOptions();
  const mutations = useProductMutations();
  const [archiveTarget, setArchiveTarget] = useState<ProductListItem | null>(null);

  async function archiveProduct() {
    if (!archiveTarget) return;
    try {
      await mutations.archive(archiveTarget.id);
      showToast({ title: "Producto archivado", tone: "success" });
      setArchiveTarget(null);
      reload();
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
      <PageHeader
        title="Catalogo y precios"
        description="Administra los productos disponibles para venta y sus configuraciones."
        actions={<Button href="/catalogo/productos/nuevo">+ Agregar producto</Button>}
      />
      <ProductFilters
        categories={options?.categories ?? []}
        filters={filters}
        onChange={updateFilters}
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
            onArchive={setArchiveTarget}
            products={paginatedProducts}
          />
          {products.length === 0 ? (
            <div className="flex justify-center">
              <Button href="/catalogo/productos/nuevo">Agregar producto</Button>
            </div>
          ) : null}
          {filteredProducts.length > 0 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
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
