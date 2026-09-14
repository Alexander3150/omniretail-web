import type { DashboardSummaryDto } from "@/modules/administration/application/dto/DashboardDto";
import { KPICard } from "@/shared/components/KPICard";
import { formatCurrency } from "@/shared/utils/formatCurrency";

interface DashboardKpisProps {
  loading: boolean;
  summary: DashboardSummaryDto | null;
}

export function DashboardKpis({ loading, summary }: DashboardKpisProps) {
  const stockAlerts = summary ? summary.stockAlerts.outOfStock + summary.stockAlerts.lowStock : 0;
  const stockTone = summary?.stockAlerts.outOfStock
    ? "danger"
    : summary?.stockAlerts.lowStock
      ? "warning"
      : "neutral";

  return (
    <section
      aria-label="Indicadores ejecutivos"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <KPICard
        hint={`${summary?.salesToday.count ?? 0} ventas`}
        label="Ventas hoy"
        loading={loading}
        tone="success"
        value={formatCurrency(summary?.salesToday.amount ?? 0)}
      />
      <KPICard
        hint={`${summary?.salesMonth.count ?? 0} ventas`}
        label="Ventas del mes"
        loading={loading}
        tone="success"
        value={formatCurrency(summary?.salesMonth.amount ?? 0)}
      />
      <KPICard
        hint={`${summary?.stockAlerts.outOfStock ?? 0} sin stock · ${summary?.stockAlerts.lowStock ?? 0} bajo`}
        label="Alertas de stock"
        loading={loading}
        tone={stockTone}
        value={stockAlerts}
      />
      <KPICard
        hint="Pedidos que esperan atención"
        label="Pedidos pendientes"
        loading={loading}
        tone={summary?.pendingOrders ? "warning" : "neutral"}
        value={summary?.pendingOrders ?? 0}
      />
    </section>
  );
}
