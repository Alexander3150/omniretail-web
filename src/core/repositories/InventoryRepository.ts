import type {
  InventoryBalance,
  InventoryMovement,
  InventoryReservation,
  InventoryReservationConsumedAllocation,
  ProductInventorySettings,
  SerialNumber,
  StockLot,
  StorageLocation,
} from "@/core/entities";
import type { InventoryMovementType } from "@/core/enums";

export interface PickingInventoryLotAvailability {
  lotId: string;
  lotNumber: string;
  expirationDate?: string;
  physicalQuantity: number;
  serialNumbers: Array<{ id: string; serialNumber: string }>;
}

export interface PickingInventoryLocationAvailability {
  balanceId: string;
  locationId?: string;
  locationCode?: string;
  locationName?: string;
  physicalQuantity: number;
  ownReservedQuantity: number;
  otherReservedQuantity: number;
  freeQuantity: number;
  usableQuantity: number;
  lots: PickingInventoryLotAvailability[];
  serialNumbers: Array<{ id: string; serialNumber: string; lotId?: string }>;
}

export interface PickingInventoryAvailability {
  tenantId: string;
  branchId: string;
  pickingOrderId: string;
  orderId: string;
  productId: string;
  physicalQuantity: number;
  ownReservedQuantity: number;
  otherReservedQuantity: number;
  freeQuantity: number;
  usableQuantity: number;
  locations: PickingInventoryLocationAvailability[];
}

export interface GetPickingInventoryAvailabilityInput {
  tenantId: string;
  branchId: string;
  pickingOrderId: string;
  orderId: string;
  productId: string;
  at?: string;
}
export interface RegisterInventoryMovementInput {
  tenantId: string;
  branchId: string;
  productId: string;
  lotId?: string;
  type: InventoryMovementType;
  reason: string;
  quantity: number;
  quantityBefore?: number;
  quantityAfter?: number;
  fromLocationId?: string;
  toLocationId?: string;
  referenceType?: string;
  referenceId?: string;
  performedByUserId?: string;
}

export interface ReserveOrderItemInput {
  tenantId: string;
  branchId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  quantity: number;
}

export interface ReleaseInventoryReservationInput {
  tenantId: string;
  branchId: string;
  reservationId: string;
}

export interface ConsumeInventoryReservationInput extends ReleaseInventoryReservationInput {
  allocationsConsumed: InventoryReservationConsumedAllocation[];
  serialNumbers?: string[];
  operationId: string;
  performedByUserId: string;
}

export interface ConsumeInventoryReservationResult {
  reservation: InventoryReservation;
  inventoryMovements: InventoryMovement[];
  idempotent: boolean;
}

export type UpsertProductInventorySettingsInput = Omit<
  ProductInventorySettings,
  "id" | "createdAt" | "updatedAt"
>;

export interface InventoryRepository {
  getBalances(): Promise<InventoryBalance[]>;
  getReservationById(tenantId: string, reservationId: string): Promise<InventoryReservation | null>;
  getReservationByOrderItem(
    tenantId: string,
    orderItemId: string,
  ): Promise<InventoryReservation | null>;
  reserveForOrderItem(input: ReserveOrderItemInput): Promise<InventoryReservation>;
  releaseReservation(input: ReleaseInventoryReservationInput): Promise<InventoryReservation>;
  consumeReservation(
    input: ConsumeInventoryReservationInput,
  ): Promise<ConsumeInventoryReservationResult>;
  getPickingAvailability(
    input: GetPickingInventoryAvailabilityInput,
  ): Promise<PickingInventoryAvailability>;
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
