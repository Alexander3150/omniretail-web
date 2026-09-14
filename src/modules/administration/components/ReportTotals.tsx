import type { ReportTotals } from "@/modules/administration/application/dto/ReportDto";
import {
  getMovementTypeLabel,
  getPaymentMethodLabel,
  getReportStatusLabel,
} from "@/modules/administration/application/reportLabels";
import { formatCurrency } from "@/shared/utils/formatCurrency";

export function ReportTotals({ totals }: { totals: ReportTotals }) {
  const items = getTotalItems(totals);

  return (
    <section aria-label="Totales del reporte" className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          className="min-w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-sm"
          key={item.label}
        >
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-bold text-[var(--color-title)]">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function getTotalItems(totals: ReportTotals): Array<{ label: string; value: string | number }> {
  if (totals.kind === "sales") {
    return [
      { label: "Ventas completadas", value: totals.count },
      { label: "Excluidas · canceladas/devueltas", value: totals.excludedCount },
      { label: "Total completado", value: formatCurrency(totals.total) },
      { label: "Descuentos completados", value: formatCurrency(totals.discountTotal) },
      { label: "Impuestos completados", value: formatCurrency(totals.taxTotal) },
    ];
  }
  if (totals.kind === "purchases") {
    return [
      { label: "Órdenes operativas", value: totals.count },
      { label: "Excluidas · borrador/canceladas", value: totals.excludedCount },
      { label: "Total operativo", value: formatCurrency(totals.total) },
    ];
  }
  if (totals.kind === "movements") {
    return totals.byType.length
      ? totals.byType.flatMap((group) => [
          { label: `${getMovementTypeLabel(group.type)} · movimientos`, value: group.count },
          { label: `${getMovementTypeLabel(group.type)} · cantidad`, value: group.quantity },
        ])
      : [{ label: "Movimientos", value: 0 }];
  }
  return [
    { label: "Pagos", value: totals.count },
    ...totals.byMethod.map((group) => ({
      label: `Método · ${getPaymentMethodLabel(group.method)}`,
      value: formatCurrency(group.amount),
    })),
    ...totals.byStatus.map((group) => ({
      label: `Estado · ${getReportStatusLabel(group.status)}`,
      value: formatCurrency(group.amount),
    })),
  ];
}
