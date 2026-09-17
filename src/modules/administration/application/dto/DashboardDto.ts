export interface DashboardIncidentDto {
  description: string;
  typeName?: string;
  createdAt: string;
}

export interface DashboardTopProduct {
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface DashboardSummaryDto {
  salesToday: { amount: number; count: number };
  salesMonth: { amount: number; count: number };
  stockAlerts: { outOfStock: number; lowStock: number };
  pendingOrders: number;
  latestIncidents: DashboardIncidentDto[];
  topProducts: DashboardTopProduct[];
}
