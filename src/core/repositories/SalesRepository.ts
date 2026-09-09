import type { Sale, SaleDocumentSnapshot, SaleItem } from "@/core/entities";
import type { SaleStatus } from "@/core/enums";

export type CreateSaleItemInput = Omit<SaleItem, "id" | "saleId">;

export interface CreateSaleInput {
  tenantId: string;
  branchId: string;
  customerId?: string;
  sourceOrderId?: string;
  confirmationId?: string;
  cashShiftId: string;
  items: CreateSaleItemInput[];
  document?: SaleDocumentSnapshot;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  createdByUserId: string;
}

export interface SalesRepository {
  getAll(): Promise<Sale[]>;
  getById(id: string): Promise<Sale | null>;
  create(input: CreateSaleInput): Promise<Sale>;
  updateStatus(id: string, status: SaleStatus): Promise<Sale>;
}
