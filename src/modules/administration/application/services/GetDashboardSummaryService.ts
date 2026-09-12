import { SaleStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { DashboardSummaryDto } from "@/modules/administration/application/dto/DashboardDto";
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
