import type { SaleReversalResultDto } from "@/modules/pos/application/dto/SaleReversalResultDto";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};

export function SaleReversalResult({ result }: { result: SaleReversalResultDto }) {
  return (
    <section
      className="rounded-xl border border-[var(--color-success)]/40 bg-white p-5 shadow-sm"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          status={result.operationType === "void" ? "Venta anulada" : "Devolución completada"}
          tone="success"
        />
        {result.idempotent ? <StatusBadge status="Resultado recuperado" tone="info" /> : null}
      </div>
      <h2 className="mt-3 text-xl font-bold text-[var(--color-title)]">
        {result.documentNumber} · {formatCurrency(result.refundTotal)}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        La operación fue procesada y la información de la venta se actualizó desde la fuente
        canónica.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-[var(--color-app-background)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Nota de crédito
          </p>
          <p className="mt-1 font-bold text-[var(--color-title)]">
            {result.creditNote.documentNumber}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {formatCurrency(result.creditNote.amount)}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--color-app-background)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Reembolso procesado
          </p>
          {result.refunds.map((refund) => (
            <p
              className="mt-1 text-sm text-[var(--color-title)]"
              key={`${refund.paymentId}-${refund.method}`}
            >
              {paymentLabels[refund.method] ?? refund.method}: {formatCurrency(refund.amount)}
            </p>
          ))}
          {result.cashMovementId ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Se registró automáticamente la salida de efectivo.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
