import type { ReturnSaleLookupDto } from "@/modules/pos/application/dto/ReturnSaleLookupDto";
import type { SaleReversalMode } from "@/modules/pos/hooks/usePosReturns";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { InlineAlert } from "@/shared/components/InlineAlert";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { formatDate } from "@/shared/utils/formatDate";

interface ReturnSaleDetailsProps {
  lookup: ReturnSaleLookupDto;
  canProcessReturn: boolean;
  canVoid: boolean;
  onBeginOperation: (mode: SaleReversalMode) => void;
}

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Mixto",
};

export function ReturnSaleDetails({
  lookup,
  canProcessReturn,
  canVoid,
  onBeginOperation,
}: ReturnSaleDetailsProps) {
  const columns: DataTableColumn<ReturnSaleLookupDto["items"][number]>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (item) => (
        <div>
          <p className="font-semibold text-[var(--color-title)]">{item.name}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{item.sku}</p>
          {item.blockedReason ? (
            <p className="mt-1 text-xs text-[var(--color-warning)]">{item.blockedReason}</p>
          ) : null}
        </div>
      ),
    },
    { key: "sold", header: "Vendida", cell: (item) => item.soldQuantity },
    { key: "returned", header: "Devuelta", cell: (item) => item.returnedQuantity },
    {
      key: "returnable",
      header: "Retornable",
      cell: (item) => (
        <span className={item.canReturn ? "font-bold text-[var(--color-title)]" : undefined}>
          {item.returnableQuantity}
        </span>
      ),
    },
    { key: "subtotal", header: "Importe", cell: (item) => formatCurrency(item.subtotal) },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--color-title)]">Documento encontrado</h2>
              <StatusBadge
                status={saleStatusLabel(lookup.sale.status)}
                tone={saleStatusTone(lookup.sale.status)}
              />
              <StatusBadge
                status={lookup.isWithinCurrentShift ? "Dentro del turno" : "Fuera del turno"}
                tone={lookup.isWithinCurrentShift ? "success" : "neutral"}
              />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              La elegibilidad y las cantidades provienen de la validación vigente de la venta.
            </p>
          </div>
          <p className="text-2xl font-bold text-[var(--color-title)]">
            {formatCurrency(lookup.sale.total)}
          </p>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryValue label="Documento" value={lookup.sale.documentNumber} />
          <SummaryValue label="Fecha" value={formatDate(lookup.sale.date)} />
          <SummaryValue label="Cliente" value={lookup.sale.customerDisplayName} />
          <SummaryValue label="Pago" value={formatPaymentSummary(lookup.paymentSummary)} />
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Productos de la venta</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Las cantidades retornables incluyen las devoluciones procesadas previamente.
          </p>
        </div>
        <DataTable columns={columns} data={lookup.items} rowKey={(item) => item.saleItemId} />
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Reembolso disponible</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            El sistema distribuirá el reembolso definitivo sobre los pagos originales.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lookup.payments.map((payment) => (
            <div
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-3"
              key={payment.paymentId}
            >
              <p className="font-semibold text-[var(--color-title)]">
                {paymentLabels[payment.method] ?? payment.method}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Disponible: {formatCurrency(payment.refundableAmount)}
              </p>
              {payment.refundedAmount > 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Reembolsado: {formatCurrency(payment.refundedAmount)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Operación</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Selecciona únicamente una operación permitida por el estado actual del documento.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OperationCard
            description="Devuelve cantidades específicas y conserva el resto de la venta."
            disabled={!canProcessReturn || !lookup.allowedOperations.partialReturn}
            label="Devolución parcial"
            reason={
              !canProcessReturn
                ? "No tienes permiso para procesar devoluciones."
                : lookup.allowedOperations.returnBlockedReason
            }
            onClick={() => onBeginOperation("return")}
          />
          <OperationCard
            danger
            description="Revierte por completo una venta elegible dentro de su turno original."
            disabled={!canVoid || !lookup.allowedOperations.voidTotal}
            label="Anulación total"
            reason={
              !canVoid
                ? "No tienes permiso para anular ventas."
                : lookup.allowedOperations.voidBlockedReason
            }
            onClick={() => onBeginOperation("void")}
          />
        </div>
        {!lookup.allowedOperations.partialReturn && !lookup.allowedOperations.voidTotal ? (
          <InlineAlert
            description="Consulta las razones mostradas en cada operación. La pantalla no puede forzar una reversión bloqueada."
            title="La venta no tiene operaciones disponibles"
            tone="warning"
          />
        ) : null}
      </section>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-app-background)] p-3">
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[var(--color-title)]">{value}</dd>
    </div>
  );
}

function OperationCard({
  label,
  description,
  reason,
  disabled,
  danger = false,
  onClick,
}: {
  label: string;
  description: string;
  reason?: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-border)] p-4">
      <h3 className="font-bold text-[var(--color-title)]">{label}</h3>
      <p className="mt-1 flex-1 text-sm text-[var(--color-text-muted)]">{description}</p>
      {reason ? <p className="mt-3 text-xs text-[var(--color-warning)]">{reason}</p> : null}
      <Button
        className="mt-4 w-full"
        disabled={disabled}
        type="button"
        variant={danger ? "danger" : "secondary"}
        onClick={onClick}
      >
        {disabled ? "No disponible" : `Iniciar ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}

function formatPaymentSummary(summary: string) {
  return summary
    .split(" + ")
    .map((method) => paymentLabels[method] ?? method)
    .join(" + ");
}

function saleStatusLabel(status: ReturnSaleLookupDto["sale"]["status"]) {
  if (status === "completed") return "Completada";
  if (status === "partially_returned") return "Devuelta parcialmente";
  if (status === "returned") return "Devuelta totalmente";
  return "Anulada";
}

function saleStatusTone(status: ReturnSaleLookupDto["sale"]["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "partially_returned") return "warning" as const;
  if (status === "returned") return "neutral" as const;
  return "danger" as const;
}
