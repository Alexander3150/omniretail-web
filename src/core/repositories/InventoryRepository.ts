import type {
  InventoryBalance,
  InventoryMovement,
  SerialNumber,
  StockLot,
  StorageLocation,
} from "@/core/entities";
import type { InventoryMovementType } from "@/core/enums";
export interface RegisterInventoryMovementInput {
  tenantId: string;
  branchId: string;
  productId: string;
  type: InventoryMovementType;
  reason: string;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  referenceType?: string;
  referenceId?: string;
  performedByUserId?: string;
}
export interface InventoryRepository {
  getBalances(): Promise<InventoryBalance[]>;
  getBalanceByProduct(productId: string, branchId?: string): Promise<InventoryBalance[]>;
  getMovements(productId?: string): Promise<InventoryMovement[]>;
  getLots(productId?: string): Promise<StockLot[]>;
  getSerialNumbers(productId?: string): Promise<SerialNumber[]>;
  getLocations(branchId?: string): Promise<StorageLocation[]>;
  registerMovement(input: RegisterInventoryMovementInput): Promise<InventoryMovement>;
  adjustStock(input: Omit<RegisterInventoryMovementInput, "type">): Promise<InventoryMovement>;
  transferStock(
    input: Omit<RegisterInventoryMovementInput, "type" | "quantity"> & {
      quantity: number;
      fromLocationId: string;
      toLocationId: string;
    },
  ): Promise<InventoryMovement>;
}
