import type { PurchaseOrder } from "@/core/entities";
import type { PurchaseOrderStatus } from "@/core/enums";
export interface PurchaseOrderRepository {
  getAll(): Promise<PurchaseOrder[]>;
  getById(id: string): Promise<PurchaseOrder | null>;
  create(input: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">): Promise<PurchaseOrder>;
  update(
    id: string,
    input: Partial<Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">>,
  ): Promise<PurchaseOrder>;
  updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder>;
}
