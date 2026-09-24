import type { SaleTicketItemDto } from "@/modules/pos/application/dto/SaleTicketDto";
import { Button } from "@/shared/components/Button";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface SaleTicketProps {
  items: SaleTicketItemDto[];
  subtotal: number;
  discountTotal: number;
  total: number;
  error: string | null;
  canCheckout: boolean;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

export function SaleTicket({
  items,
  subtotal,
  discountTotal,
  total,
  error,
  canCheckout,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
}: SaleTicketProps) {
  return (
    <aside className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm xl:sticky xl:top-4">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-app-background)] px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--color-title)]">Ticket de venta</h2>
          <p className="shrink-0 text-sm font-medium text-[var(--color-text-muted)]">
            {items.length === 1 ? "1 producto" : `${items.length} productos`}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {error ? (
          <p className="mb-4 rounded-md border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-app-background)] px-5 py-10 text-center">
            <p className="font-semibold text-[var(--color-title)]">Tu ticket está vacío</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--color-text-muted)]">
              Busca o selecciona un producto para agregarlo a la venta.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li className="py-3 first:pt-0" key={item.productId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.sku}</p>
                  </div>
                  <p className="shrink-0 font-bold text-[var(--color-title)]">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2" aria-label={`Cantidad de ${item.name}`}>
                    <button
                      aria-label={`Disminuir cantidad de ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
                      onClick={() => onDecrease(item.productId)}
                      type="button"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-semibold text-[var(--color-text)]">
                      {item.quantity} {item.saleUnitName}
                    </span>
                    <button
                      aria-label={`Aumentar cantidad de ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={item.tracksStock && item.quantity >= (item.availableQuantity ?? 0)}
                      onClick={() => onIncrease(item.productId)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="text-sm font-semibold text-[var(--color-danger)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)]"
                    onClick={() => onRemove(item.productId)}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>

                <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                  <p>{formatCurrency(item.unitPrice)} por unidad</p>
                  {item.discount > 0 ? (
                    <p>Descuento por unidad: {formatCurrency(item.discount)}</p>
                  ) : null}
                  {item.requiresUnsupportedTraceability ? (
                    <p className="mt-1 font-semibold text-[var(--color-warning)]">
                      Esta línea requiere un proceso de venta distinto.
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="space-y-2 border-t border-[var(--color-border)] bg-[var(--color-app-background)] px-4 py-3 text-sm sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Subtotal</dt>
          <dd className="font-semibold text-[var(--color-text)]">{formatCurrency(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Descuentos</dt>
          <dd className="font-semibold text-[var(--color-text)]">
            − {formatCurrency(discountTotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-2">
          <dt className="text-base font-bold text-[var(--color-title)]">Total</dt>
          <dd className="text-xl font-bold text-[var(--color-title)]">{formatCurrency(total)}</dd>
        </div>
      </dl>
      <div className="border-t border-[var(--color-border)] p-4 sm:px-5">
        <Button className="w-full" disabled={!canCheckout} onClick={onCheckout} type="button">
          Cobrar
        </Button>
      </div>
    </aside>
  );
}
