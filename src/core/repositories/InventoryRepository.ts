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

export type InventoryMovementDisplayType =
  | "purchase_in"
  | "sale"
  | "return"
  | "void"
  | "dispatch"
  | "in"
  | "out"
  | "transfer";

export type InventoryMovementSort =
  | "createdAt,asc"
  | "createdAt,desc"
  | "quantity,asc"
  | "quantity,desc"
  | "type,asc"
  | "type,desc"
  | "productId,asc"
  | "productId,desc"
  | "branchId,asc"
  | "branchId,desc";

export interface InventoryMovementPageParams {
  branchId?: string;
  productId?: string;
  type?: InventoryMovementType;
  from?: string;
  to?: string;
  search?: string;
  displayType?: InventoryMovementDisplayType;
  page: number;
  pageSize: number;
  sort?: InventoryMovementSort;
}

export interface InventoryMovementListItem {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string | null;
  productId: string;
  productName: string | null;
  sku: string | null;
  type: InventoryMovementType;
  displayType: InventoryMovementDisplayType;
  reason: string;
  quantity: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  fromLocationId: string | null;
  fromLocationName: string | null;
  toLocationId: string | null;
  toLocationName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  performedByUserId: string | null;
  userLabel: string | null;
  createdAt: string;
}

export interface InventoryMovementPageResult {
  items: InventoryMovementListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: {
    incoming: number;
    outgoing: number;
    net: number;
  };
}

export type InventoryStockStatus = "out_of_stock" | "critical" | "near_minimum" | "normal";

export type InventoryStockSort =
  | "productName,asc"
  | "productName,desc"
  | "sku,asc"
  | "sku,desc"
  | "categoryName,asc"
  | "categoryName,desc"
  | "availableQuantity,asc"
  | "availableQuantity,desc"
  | "status,asc"
  | "status,desc";

/** Disponibilidad operacional (quantity - reserved) de otra sucursal; NO existencia fisica. */
export interface OtherBranchAvailability {
  branchId: string;
  branchName: string;
  availableQuantity: number;
}

export interface GetOtherBranchesAvailabilityInput {
  productId: string;
  /** Sucursal activa: el backend la excluye y filtra por acceso. */
  branchId: string;
}

export interface InventoryStockPageParams {
  branchId: string;
  search?: string;
  categoryId?: string;
  status?: InventoryStockStatus;
  page: number;
  pageSize: number;
  sort?: InventoryStockSort;
}

export interface InventoryStockListItem {
  productId: string;
  branchId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  baseUnitId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStock: number;
  reorderPoint: number;
  defaultLocationId: string | null;
  defaultLocationName: string | null;
  status: InventoryStockStatus;
  suggestedReorder: number;
}

export interface InventoryStockPageResult {
  items: InventoryStockListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: {
    activeProducts: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface InventoryAlertPageParams {
  branchId: string;
  status?: Exclude<InventoryStockStatus, "normal">;
  page: number;
  pageSize: number;
}

export interface InventoryAlertListItem {
  productId: string;
  branchId: string;
  sku: string;
  productName: string;
  baseUnitId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStock: number;
  reorderPoint: number;
  defaultLocationId: string | null;
  status: Exclude<InventoryStockStatus, "normal">;
  suggestedReorder: number;
}

export interface InventoryAlertPageResult {
  items: InventoryAlertListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

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
  orderId?: string;
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
  pickingItemId?: string;
  orderId?: string;
  sourceType?: "order" | "transfer";
  sourceId?: string;
  productId: string;
  at?: string;
}

export interface PickingFulfillmentTraceLocation {
  id: string;
  code: string;
  name: string;
}

export interface PickingFulfillmentTraceLot {
  id: string;
  number: string;
  expiresAt?: string;
}

export interface PickingFulfillmentTraceSerial {
  id: string;
  number: string;
}

export interface PickingFulfillmentTraceAllocation {
  inventoryMovementId?: string;
  reservationId: string;
  quantity: number;
  location?: PickingFulfillmentTraceLocation;
  lot?: PickingFulfillmentTraceLot;
  serial?: PickingFulfillmentTraceSerial;
  consumedAt?: string;
}

export interface PickingFulfillmentItemTrace {
  pickingItemId: string;
  orderItemId: string;
  productId: string;
  requestedQuantity: number;
  pickedQuantity: number;
  allocations: PickingFulfillmentTraceAllocation[];
}

export interface GetPickingFulfillmentTraceInput {
  tenantId: string;
  branchId: string;
  orderId: string;
  pickingOrderId: string;
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
  orderId?: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  sourceType?: "order" | "transfer";
  sourceId?: string;
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
  getPickingFulfillmentTrace(
    input: GetPickingFulfillmentTraceInput,
  ): Promise<PickingFulfillmentItemTrace[]>;
  getBalanceByProduct(productId: string, branchId?: string): Promise<InventoryBalance[]>;
  getMovements(productId?: string): Promise<InventoryMovement[]>;
  getMovementPage(params: InventoryMovementPageParams): Promise<InventoryMovementPageResult>;
  getStockPage(params: InventoryStockPageParams): Promise<InventoryStockPageResult>;
  /** Solo modo API: una request on-demand a GET /inventory/stock/branches. */
  getOtherBranchesAvailability(
    input: GetOtherBranchesAvailabilityInput,
  ): Promise<OtherBranchAvailability[]>;
  getInventoryAlertPage(params: InventoryAlertPageParams): Promise<InventoryAlertPageResult>;
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
