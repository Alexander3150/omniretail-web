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

    const [
      sales,
      pendingLogisticsOrders,
      branches,
      receipts,
      incidents,
      incidentTypes,
      purchaseOrders,
      inventoryTransfers,
      suppliers,
    ] = await Promise.all([
        this.repositories.sales.getAll(),
        this.repositories.orders.getPendingForLogistics(),
        this.repositories.branches.getActive(),
        this.repositories.receipts.getAll(),
        this.repositories.receipts.getIncidents(),
        this.repositories.incidentTypes.getAll(),
        this.repositories.purchaseOrders.getAll(),
        this.repositories.inventoryTransfers.query({ tenantId }),
        this.repositories.suppliers.getAll(),
      ]);
    const now = new Date();
    const tenantSales = sales.filter(
      (sale) => sale.tenantId === tenantId && sale.status !== SaleStatus.cancelled,
    );
    const todaySales = tenantSales.filter((sale) => isSameLocalDay(new Date(sale.createdAt), now));
    const monthSales = tenantSales.filter((sale) =>
      isSameLocalMonth(new Date(sale.createdAt), now),
    );
    const tenantReceipts = receipts.filter((receipt) => receipt.tenantId === tenantId);
    const receiptById = new Map(
      tenantReceipts.map((receipt) => [receipt.id, receipt]),
    );
    const incidentTypeNames = new Map(
      incidentTypes
        .filter((incidentType) => incidentType.tenantId === tenantId)
        .map((incidentType) => [incidentType.id, incidentType.name]),
    );
    const tenantPendingLogisticsOrders = pendingLogisticsOrders.filter(
      (order) => order.tenantId === tenantId,
    );
    const pendingOrdersByStatus = {
      confirmed: 0,
      preparing: 0,
      picking: 0,
      packing: 0,
      ready_for_dispatch: 0,
    };

    tenantPendingLogisticsOrders.forEach((order) => {
      switch (order.status) {
        case "confirmed":
          pendingOrdersByStatus.confirmed += 1;
          break;
        case "preparing":
          pendingOrdersByStatus.preparing += 1;
          break;
        case "picking":
          pendingOrdersByStatus.picking += 1;
          break;
        case "packing":
          pendingOrdersByStatus.packing += 1;
          break;
        case "ready_for_dispatch":
          pendingOrdersByStatus.ready_for_dispatch += 1;
          break;
      }
    });

    const tenantBranches = branches.filter((branch) => branch.tenantId === tenantId);
    const branchNameById = new Map(
      tenantBranches.map((branch) => [branch.id, branch.name]),
    );
    const purchaseOrderById = new Map(
      purchaseOrders
        .filter((purchaseOrder) => purchaseOrder.tenantId === tenantId)
        .map((purchaseOrder) => [purchaseOrder.id, purchaseOrder]),
    );
    const inventoryTransferById = new Map(
      inventoryTransfers.map((item) => [item.transfer.id, item.transfer]),
    );
    const supplierNameById = new Map(
      suppliers
        .filter((supplier) => supplier.tenantId === tenantId)
        .map((supplier) => [supplier.id, supplier.name]),
    );
    const inventoryAlertsService = new GetInventoryAlertsService(this.repositories);
    const branchAlerts = await Promise.all(
      tenantBranches.map(async (branch) => ({
        branch,
        data: await inventoryAlertsService.execute(branch.id),
      })),
    );
    const stockAlerts = branchAlerts.reduce(
      (totals, result) => ({
        outOfStock: totals.outOfStock + result.data.kpis.outOfStock,
        lowStock: totals.lowStock + result.data.kpis.lowStock,
      }),
      { outOfStock: 0, lowStock: 0 },
    );
    const stockAlertsByBranch = branchAlerts.map(({ branch, data }) => {
      const branchStockAlerts = data.kpis;

      return {
        branchId: branch.id,
        branchName: branch.name,
        outOfStock: branchStockAlerts.outOfStock,
        lowStock: branchStockAlerts.lowStock,
        total: branchStockAlerts.outOfStock + branchStockAlerts.lowStock,
      };
    });

    const topProducts = aggregateTopProducts(monthSales);

    return {
      salesToday: summarizeSales(todaySales),
      salesMonth: summarizeSales(monthSales),
      stockAlerts,
      stockAlertsByBranch,
      pendingOrders: tenantPendingLogisticsOrders.length,
      pendingOrdersByStatus,
      latestIncidents: incidents
        .filter((incident) => receiptById.has(incident.receiptId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
        .map((incident) => {
          const receipt = receiptById.get(incident.receiptId);
          const purchaseOrder = receipt?.purchaseOrderId
            ? purchaseOrderById.get(receipt.purchaseOrderId)
            : undefined;
          const transfer = receipt?.inventoryTransferId
            ? inventoryTransferById.get(receipt.inventoryTransferId)
            : undefined;
          const branchName = receipt?.branchId
            ? branchNameById.get(receipt.branchId)
            : undefined;
          const supplierName = purchaseOrder?.supplierId
            ? supplierNameById.get(purchaseOrder.supplierId)
            : undefined;
          const originBranchName = transfer?.sourceBranchId
            ? branchNameById.get(transfer.sourceBranchId)
            : undefined;

          return {
            description: incident.description,
            typeName: incidentTypeNames.get(incident.incidentTypeId) ?? incident.incidentTypeId,
            createdAt: incident.createdAt,
            ...(receipt?.number ? { receiptNumber: receipt.number } : {}),
            ...(branchName ? { branchName } : {}),
            ...(purchaseOrder?.number
              ? { purchaseOrderNumber: purchaseOrder.number }
              : {}),
            ...(transfer?.number ? { transferNumber: transfer.number } : {}),
            ...(supplierName ? { supplierName } : {}),
            ...(originBranchName ? { originBranchName } : {}),
          };
        }),
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
