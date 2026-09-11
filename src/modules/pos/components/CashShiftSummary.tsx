import type { CashShift } from "@/core/entities";
import type { CashShiftSummaryDto } from "@/modules/pos/application/dto/CashShiftSummaryDto";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { formatDate } from "@/shared/utils/formatDate";

interface CashShiftSummaryProps {
  branchName: string | null;
  cashierName: string | null;
  cashShift: CashShift;
  summary: CashShiftSummaryDto;
}

export function CashShiftSummary({
  branchName,
  cashierName,
  cashShift,
  summary,
}: CashShiftSummaryProps) {
  return (
    <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-title)]">Turno activo</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {cashShift.registerCode} · {branchName ?? "Sucursal activa"} · {cashierName ?? "Cajero"}
          </p>
        </div>
        <StatusBadge status="Caja abierta" tone="success" />
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Apertura: {formatDate(summary.openedAt)}
      </p>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryValue label="Fondo inicial" value={summary.openingAmount} />
        <SummaryValue label="Ventas en efectivo" value={summary.cashSalesAmount} />
        <SummaryValue label="Ingresos manuales" value={summary.manualCashIn} />
        <SummaryValue label="Egresos manuales" value={summary.manualCashOut} />
      </dl>

      <div className="rounded-lg bg-[var(--color-app-background)] p-4">
        <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          Efectivo esperado
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--color-title)]">
          {formatCurrency(summary.expectedCash)}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Fuente canónica: {summary.movementCount} movimientos · {summary.saleCount} ventas
        </p>
      </div>
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 font-bold text-[var(--color-title)]">{formatCurrency(value)}</dd>
    </div>
  );
}
