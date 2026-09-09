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
  onCheckout,
}: SaleTicketProps) {
  return (
    <aside className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <div className="border-b border-[var(--color-border)] p-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Ticket de venta</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {items.length === 1 ? "1 producto" : `${items.length} productos`}
          </p>
        </div>
      </div>

      <div className="p-5">
        {error ? (
          <p className="mb-4 rounded-md border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <p className="font-semibold text-[var(--color-text)]">El ticket está vacío</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Agrega un producto desde la lista para comenzar.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li className="py-4 first:pt-0" key={item.productId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.sku}</p>
                  </div>
                  <p className="shrink-0 font-bold text-[var(--color-title)]">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
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
                      {item.quantity}
                    </span>
                    <button
                      aria-label={`Aumentar cantidad de ${item.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] font-bold text-[var(--color-title)] transition hover:bg-[var(--color-app-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        item.tracksStock && item.quantity >= (item.availableQuantity ?? 0)
                      }
                      onClick={() => onIncrease(item.productId)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                  <p>{formatCurrency(item.unitPrice)} por unidad</p>
                  {item.discount > 0 ? (
                    <p>Descuento por unidad: {formatCurrency(item.discount)}</p>
                  ) : null}
                  {item.requiresUnsupportedTraceability ? (
                    <p className="mt-1 font-semibold text-[var(--color-warning)]">
                      Esta línea no podrá confirmarse en esta fase.
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="space-y-3 border-t border-[var(--color-border)] bg-[var(--color-app-background)] p-5 text-sm">
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
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-3">
          <dt className="text-base font-bold text-[var(--color-title)]">Total</dt>
          <dd className="text-xl font-bold text-[var(--color-title)]">{formatCurrency(total)}</dd>
        </div>
      </dl>
      <div className="border-t border-[var(--color-border)] p-5">
        <Button
          className="w-full"
          disabled={!canCheckout}
          onClick={onCheckout}
          type="button"
        >
          Cobrar
        </Button>
      </div>
    </aside>
  );
}
