import type { PosSaleHistoryItemDto } from "@/modules/pos/application/dto/PosSaleHistoryDto";
import { Modal } from "@/shared/components/Modal";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface PosSaleProductsModalProps {
  sale: PosSaleHistoryItemDto | null;
  onClose: () => void;
}

export function PosSaleProductsModal({ sale, onClose }: PosSaleProductsModalProps) {
  const totalUnits = sale?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  return (
    <Modal
      open={Boolean(sale)}
      density="compact"
      maxWidth="760px"
      size="lg"
      subtitle={
        sale
          ? `${sale.documentType === "invoice" ? "Factura" : "Ticket"} · ${sale.customerDisplayName}`
          : undefined
      }
      title={sale ? `Productos de ${sale.documentNumber}` : "Productos de la venta"}
      onClose={onClose}
    >
      {sale ? (
        <div className="space-y-4">
          <dl className="grid gap-2 rounded-xl border border-[var(--color-primary)]/35 bg-[var(--color-warning)]/15 p-3 sm:grid-cols-3">
            <SummaryItem label="Tipo de entrega" value={sale.deliveryMethodLabel} />
            <SummaryItem label="Unidades totales" value={String(totalUnits)} />
            <SummaryItem label="Total de la venta" value={formatCurrency(sale.total)} />
          </dl>

          <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
            {sale.items.map((item) => (
              <article
                className="rounded-lg border border-[var(--color-primary)]/30 bg-white p-3 shadow-sm"
                key={`${sale.saleId}:${item.productId}:${item.sku}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-[var(--color-title)]">{item.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">SKU {item.sku}</p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-semibold text-[var(--color-title)]">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {formatCurrency(item.unitPrice)} por unidad
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <dt className="text-[11px] font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}
