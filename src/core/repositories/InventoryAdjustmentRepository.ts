import type { InventoryAdjustment, InventoryMovement } from "@/core/entities";
import type { InventoryAdjustmentType } from "@/core/enums";

export interface InventoryAdjustmentFilters {
  tenantId?: string;
  branchId?: string;
  productId?: string;
}

export interface CreateInventoryAdjustmentInput {
  tenantId: string;
  branchId: string;
  productId: string;
  locationId?: string;
  type: InventoryAdjustmentType;
  reason: string;
  notes?: string;
  quantityBefore: number;
  quantityAfter: number;
  performedByUserId?: string;
}

export interface RegisterInventoryAdjustmentStockInput extends CreateInventoryAdjustmentInput {
  lotId?: string;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers?: string[];
}

export interface RegisterInventoryAdjustmentStockResult {
  adjustment: InventoryAdjustment;
  movements: InventoryMovement[];
}

export interface InventoryAdjustmentRepository {
  getById(id: string): Promise<InventoryAdjustment | null>;
  getByNumber(tenantId: string, number: string): Promise<InventoryAdjustment | null>;
  query(filters?: InventoryAdjustmentFilters): Promise<InventoryAdjustment[]>;
  create(input: CreateInventoryAdjustmentInput): Promise<InventoryAdjustment>;
  registerStockAdjustment(
    input: RegisterInventoryAdjustmentStockInput,
  ): Promise<RegisterInventoryAdjustmentStockResult>;
}
