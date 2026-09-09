"use client";

import { PageHeader } from "@/shared/components/PageHeader";
import { SearchInput } from "@/shared/components/SearchInput";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { usePosTerminal } from "@/modules/pos/hooks/usePosTerminal";

export function PosTerminalPage() {
  const { products, filteredProducts, search, setSearch, loading, error } = usePosTerminal();

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Terminal de Cobro"
        description="Registra ventas desde la sucursal activa."
      />

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-title)]">Productos disponibles</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Consulta temporal del catálogo habilitado para punto de venta.
            </p>
          </div>
          <div className="w-full sm:max-w-sm">
            <SearchInput
              aria-label="Buscar productos"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, Código / SKU o barcode"
              value={search}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-[var(--color-danger)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
            {error}
          </p>
        ) : loading ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">Cargando productos...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            {products.length === 0
              ? "No hay productos disponibles para POS en esta sucursal."
              : "No hay productos que coincidan con la búsqueda."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {filteredProducts.map((product) => (
              <li
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={product.productId}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text)]">{product.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ""}
                  </p>
                  {product.requiresUnsupportedTraceability ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--color-warning)]">
                      Requiere trazabilidad no disponible para confirmación.
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="font-bold text-[var(--color-title)]">
                    {formatCurrency(product.effectivePrice)}
                  </p>
                  {product.discount > 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Antes {formatCurrency(product.basePrice)}
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {product.tracksStock
                      ? `Disponible: ${product.availableQuantity ?? 0}`
                      : "Sin control de existencia"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
