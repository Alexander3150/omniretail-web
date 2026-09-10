import { OrderStatus, SaleStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { DashboardSummaryDto } from "@/modules/administration/application/dto/DashboardDto";
import {
  ensureCanReadDashboard,
  ensureDashboardTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetDashboardSummaryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<DashboardSummaryDto> {
    ensureCanReadDashboard(permissions);
    ensureDashboardTenant(tenantId);

    const [sales, orders, balances, receipts, incidents, incidentTypes] = await Promise.all([
      this.repositories.sales.getAll(),
      this.repositories.orders.getAll(),
      this.repositories.inventory.getBalances(),
      this.repositories.receipts.getAll(),
      this.repositories.receipts.getIncidents(),
      this.repositories.incidentTypes.getAll(),
    ]);
    const now = new Date();
    const tenantSales = sales.filter(
      (sale) => sale.tenantId === tenantId && sale.status !== SaleStatus.cancelled,
    );
    const todaySales = tenantSales.filter((sale) => isSameLocalDay(new Date(sale.createdAt), now));
    const monthSales = tenantSales.filter((sale) =>
      isSameLocalMonth(new Date(sale.createdAt), now),
    );
    const tenantBalances = balances.filter((balance) => balance.tenantId === tenantId);
    const tenantReceiptIds = new Set(
      receipts.filter((receipt) => receipt.tenantId === tenantId).map((receipt) => receipt.id),
    );
    const incidentTypeNames = new Map(
      incidentTypes
        .filter((incidentType) => incidentType.tenantId === tenantId)
        .map((incidentType) => [incidentType.id, incidentType.name]),
    );

    return {
      salesToday: summarizeSales(todaySales),
      salesMonth: summarizeSales(monthSales),
      stockAlerts: {
        outOfStock: tenantBalances.filter((balance) => balance.quantity <= 0).length,
        lowStock: tenantBalances.filter(
          (balance) =>
            balance.minStock != null &&
            balance.quantity > 0 &&
            balance.quantity <= balance.minStock,
        ).length,
      },
      pendingOrders: orders.filter(
        (order) => order.tenantId === tenantId && order.status === OrderStatus.pending,
      ).length,
      latestIncidents: incidents
        .filter((incident) => tenantReceiptIds.has(incident.receiptId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
        .map((incident) => ({
          description: incident.description,
          typeName: incidentTypeNames.get(incident.incidentTypeId) ?? incident.incidentTypeId,
          createdAt: incident.createdAt,
        })),
    };
  }
}

function summarizeSales(sales: Array<{ total: number }>) {
  return {
    amount: sales.reduce((total, sale) => total + sale.total, 0),
    count: sales.length,
  };
}

function isSameLocalDay(value: Date, reference: Date) {
  return (
    value.getFullYear() === reference.getFullYear() &&
    value.getMonth() === reference.getMonth() &&
    value.getDate() === reference.getDate()
  );
}

function isSameLocalMonth(value: Date, reference: Date) {
  return (
    value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth()
  );
}
