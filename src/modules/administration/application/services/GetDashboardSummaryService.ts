import { SaleStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { DashboardSummaryDto, DashboardTopProduct } from "@/modules/administration/application/dto/DashboardDto";
import {
  ensureCanReadDashboard,
  ensureDashboardTenant,
} from "@/modules/administration/application/services/serviceHelpers";
import { GetInventoryAlertsService } from "@/modules/inventory/application/services/GetInventoryAlertsService";

export class GetDashboardSummaryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<DashboardSummaryDto> {
    ensureCanReadDashboard(permissions);
    ensureDashboardTenant(tenantId);

    const [sales, pendingLogisticsOrders, branches, receipts, incidents, incidentTypes] =
      await Promise.all([
        this.repositories.sales.getAll(),
        this.repositories.orders.getPendingForLogistics(),
        this.repositories.branches.getActive(),
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
    const tenantReceiptIds = new Set(
      receipts.filter((receipt) => receipt.tenantId === tenantId).map((receipt) => receipt.id),
    );
    const incidentTypeNames = new Map(
      incidentTypes
        .filter((incidentType) => incidentType.tenantId === tenantId)
        .map((incidentType) => [incidentType.id, incidentType.name]),
    );

    const tenantBranches = branches.filter((branch) => branch.tenantId === tenantId);
    const inventoryAlertsService = new GetInventoryAlertsService(this.repositories);
    const branchAlerts = await Promise.all(
      tenantBranches.map((branch) => inventoryAlertsService.execute(branch.id)),
    );
    const stockAlerts = branchAlerts.reduce(
      (totals, data) => ({
        outOfStock: totals.outOfStock + data.kpis.outOfStock,
        lowStock: totals.lowStock + data.kpis.lowStock,
      }),
      { outOfStock: 0, lowStock: 0 },
    );

    const topProducts = aggregateTopProducts(tenantSales);

    return {
      salesToday: summarizeSales(todaySales),
      salesMonth: summarizeSales(monthSales),
      stockAlerts,
      pendingOrders: pendingLogisticsOrders.filter((order) => order.tenantId === tenantId).length,
      latestIncidents: incidents
        .filter((incident) => tenantReceiptIds.has(incident.receiptId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
        .map((incident) => ({
          description: incident.description,
          typeName: incidentTypeNames.get(incident.incidentTypeId) ?? incident.incidentTypeId,
          createdAt: incident.createdAt,
        })),
      topProducts,
    };
  }
}

function aggregateTopProducts(
  sales: Array<{ items: Array<{ nameSnapshot: string; quantity: number; subtotal: number }> }>,
): DashboardTopProduct[] {
  const productMap = new Map<string, { totalQuantity: number; totalRevenue: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = productMap.get(item.nameSnapshot) ?? { totalQuantity: 0, totalRevenue: 0 };
      existing.totalQuantity += item.quantity;
      existing.totalRevenue += item.subtotal;
      productMap.set(item.nameSnapshot, existing);
    }
  }

  return [...productMap.entries()]
    .map(([productName, data]) => ({ productName, ...data }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10);
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
