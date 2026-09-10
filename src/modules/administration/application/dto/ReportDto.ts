export type ReportKind = "sales" | "purchases" | "movements" | "payments";

export interface ReportFilter {
  from?: string;
  to?: string;
  status?: string;
  branchId?: string;
  supplierId?: string;
  movementType?: string;
  method?: string;
}

export interface SalesReportRow {
  number: string;
  date: string;
  branchId: string;
  branchName: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export interface PurchasesReportRow {
  number: string;
  date: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  status: string;
  subtotal: number;
  total: number;
}

export interface MovementReportRow {
  date: string;
  branchId: string;
  branchName: string;
  productName: string;
  type: string;
  quantity: number;
  reason: string;
}

export interface PaymentReportRow {
  date: string;
  method: string;
  status: string;
  amount: number;
  reference: string;
  origin: "Orden" | "Venta" | "—";
}

export interface ReportsDataDto {
  sales: SalesReportRow[];
  purchases: PurchasesReportRow[];
  movements: MovementReportRow[];
  payments: PaymentReportRow[];
}

export type ReportRow =
  | SalesReportRow
  | PurchasesReportRow
  | MovementReportRow
  | PaymentReportRow;

export type ReportTotals =
  | {
      kind: "sales";
      count: number;
      total: number;
      discountTotal: number;
      taxTotal: number;
    }
  | { kind: "purchases"; count: number; total: number }
  | {
      kind: "movements";
      byType: Array<{ type: string; count: number; quantity: number }>;
    }
  | {
      kind: "payments";
      count: number;
      byMethod: Array<{ method: string; amount: number }>;
      byStatus: Array<{ status: string; amount: number }>;
    };
