import type { PurchaseOrder, PurchaseOrderItem } from "@/core/entities";
import type { PurchaseOrderStatus } from "@/core/enums";

export type PurchaseOrderItemInput = Omit<PurchaseOrderItem, "id" | "purchaseOrderId">;

export type CreatePurchaseOrderInput = Omit<
  PurchaseOrder,
  "id" | "number" | "items" | "createdAt" | "updatedAt"
> & {
  number?: string;
  items?: PurchaseOrderItemInput[];
};

export type UpdatePurchaseOrderInput = Partial<
  Omit<PurchaseOrder, "id" | "items" | "createdAt" | "updatedAt">
> & {
  items?: PurchaseOrderItemInput[];
};

export interface PurchaseOrderRepository {
  getAll(): Promise<PurchaseOrder[]>;
  getById(id: string): Promise<PurchaseOrder | null>;
  create(input: CreatePurchaseOrderInput): Promise<PurchaseOrder>;
  update(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder>;
  updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder>;
}
