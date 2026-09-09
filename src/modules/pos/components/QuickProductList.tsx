import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";
import { Button } from "@/shared/components/Button";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface QuickProductListProps {
  products: PosProductDto[];
  hasProducts: boolean;
  loading: boolean;
  error: string | null;
  onAdd: (product: PosProductDto) => void;
}

export function QuickProductList({
  products,
  hasProducts,
  loading,
  error,
  onAdd,
}: QuickProductListProps) {
  if (error) {
    return (
      <p className="rounded-md border border-[var(--color-danger)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
        {error}
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-text-muted)]">Cargando productos...</p>;
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        {hasProducts
          ? "No hay productos que coincidan con la búsqueda."
          : "No hay productos disponibles para POS en esta sucursal."}
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {products.map((product) => {
        const hasAvailableStock =
          !product.tracksStock || (product.availableQuantity ?? 0) > 0;
        const hasUnsupportedTraceability = product.requiresUnsupportedTraceability;
        const canAdd =
          !hasUnsupportedTraceability && hasAvailableStock && product.isAvailableForSale;
        const buttonLabel = hasUnsupportedTraceability
          ? "No disponible"
          : hasAvailableStock
            ? canAdd
              ? "Agregar"
              : "No disponible"
            : "Sin existencia";

        return (
          <li
            className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-[var(--color-border)] p-4"
            key={product.productId}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--color-text)]">{product.name}</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {product.sku}
                {product.barcode ? ` · ${product.barcode}` : ""}
              </p>
              <p className="mt-3 text-lg font-bold text-[var(--color-title)]">
                {formatCurrency(product.effectivePrice)}
              </p>
              {product.discount > 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Antes {formatCurrency(product.basePrice)}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                {product.tracksStock
                  ? `Disponible: ${product.availableQuantity ?? 0}`
                  : "Sin control de existencia"}
              </p>
              {hasUnsupportedTraceability ? (
                <p className="mt-2 text-xs font-semibold text-[var(--color-warning)]">
                  Producto con trazabilidad especial no disponible en POS.
                </p>
              ) : null}
            </div>

            <Button
              className="w-full"
              disabled={!canAdd}
              onClick={() => onAdd(product)}
              type="button"
              variant="secondary"
            >
              {buttonLabel}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
