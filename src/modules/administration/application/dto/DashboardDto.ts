export interface DashboardIncidentDto {
  description: string;
  typeName?: string;
  createdAt: string;
  receiptNumber?: string;
  branchName?: string;
  purchaseOrderNumber?: string;
  transferNumber?: string;
  supplierName?: string;
  originBranchName?: string;
}

export interface DashboardTopProduct {
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export type DashboardPendingOrderStatus =
  | "confirmed"
  | "preparing"
  | "picking"
  | "packing"
  | "ready_for_dispatch";

export type DashboardPendingOrdersByStatus = Record<
  DashboardPendingOrderStatus,
  number
>;

export interface DashboardStockAlertsByBranchDto {
  branchId: string;
  branchName: string;
  outOfStock: number;
  lowStock: number;
  total: number;
}

export interface DashboardSummaryDto {
  salesToday: { amount: number; count: number };
  salesMonth: { amount: number; count: number };
  stockAlerts: { outOfStock: number; lowStock: number };
  stockAlertsByBranch: DashboardStockAlertsByBranchDto[];
  pendingOrders: number;
  pendingOrdersByStatus: DashboardPendingOrdersByStatus;
  latestIncidents: DashboardIncidentDto[];
  topProducts: DashboardTopProduct[];
}
