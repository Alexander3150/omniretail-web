import type {
  InventoryBalance,
  InventoryMovement,
  ProductInventorySettings,
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

export type UpsertProductInventorySettingsInput = Omit<
  ProductInventorySettings,
  "id" | "createdAt" | "updatedAt"
>;

export interface InventoryRepository {
  getBalances(): Promise<InventoryBalance[]>;
  getBalanceByProduct(productId: string, branchId?: string): Promise<InventoryBalance[]>;
  getMovements(productId?: string): Promise<InventoryMovement[]>;
  getLots(productId?: string): Promise<StockLot[]>;
  getSerialNumbers(productId?: string): Promise<SerialNumber[]>;
  getLocations(branchId?: string): Promise<StorageLocation[]>;
  createLocation(
    input: Omit<StorageLocation, "id" | "createdAt" | "updatedAt">,
  ): Promise<StorageLocation>;
  updateLocation(
    id: string,
    input: Partial<Omit<StorageLocation, "id" | "createdAt" | "updatedAt">>,
  ): Promise<StorageLocation>;
  getProductInventorySettings(
    productId: string,
    branchId: string,
  ): Promise<ProductInventorySettings | null>;
  upsertProductInventorySettings(
    input: UpsertProductInventorySettingsInput,
  ): Promise<ProductInventorySettings>;
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
