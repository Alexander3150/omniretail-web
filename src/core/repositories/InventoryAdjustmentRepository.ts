import type { InventoryAdjustment, InventoryMovement } from "@/core/entities";
import type { InventoryAdjustmentType } from "@/core/enums";
import type { SerialValidationResult } from "@/core/repositories/ReceiptRepository";

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

export interface AdjustmentLotOption {
  lotId: string;
  lotNumber: string;
  expirationDate?: string;
  quantity: number;
  reservedQuantity: number;
  /** Capacidad real de salida: nunca la cantidad fisica. */
  availableQuantity: number;
  locationId?: string;
}

export interface AdjustmentSerialOption {
  serialId: string;
  serialNumber: string;
  lotId?: string;
  locationId?: string;
}

export interface ListAdjustmentLotsInput {
  branchId: string;
  productId: string;
  locationId?: string;
}

export interface ListAdjustmentSerialsInput extends ListAdjustmentLotsInput {
  lotId?: string;
}

export interface ValidateNewSerialsInput {
  productId: string;
  serialNumbers: string[];
}

export interface CountSerialItem {
  serialId: string;
  serialNumber: string;
  /** AVAILABLE o RESERVED: ambos siguen fisicamente presentes. */
  status: string;
}

export interface CountSnapshotLot {
  lotId: string;
  lotNumber: string;
  expirationDate?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  serials: CountSerialItem[];
}

export interface InventoryCountSnapshot {
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  locationId?: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  tracking: { lot: boolean; expiration: boolean; serial: boolean };
  lots: CountSnapshotLot[];
  /** Series sin lote. */
  serials: CountSerialItem[];
}

export interface GetCountSnapshotInput {
  branchId: string;
  productId: string;
  locationId?: string;
}

export interface ReconcileCountLotInput {
  lotId: string;
  /** Cantidad registrada del lote en el snapshot original (no se recalcula). */
  expectedQuantity: number;
  countedQuantity?: number;
  /** Composicion serial del lote en el snapshot original (anti-stale); [] es valido. */
  expectedSerialNumbers?: string[];
  foundSerialNumbers?: string[];
}

export interface ReconcileCountAdditionInput {
  quantity: number;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers?: string[];
}

export interface ReconcileCountInput {
  branchId: string;
  productId: string;
  locationId?: string;
  reason: string;
  /** Existencia registrada que vio el usuario: solo detecta snapshot vencido. */
  expectedQuantity: number;
  lots?: ReconcileCountLotInput[];
  /** Composicion serial sin lote del snapshot original (anti-stale); [] es valido. */
  expectedSerialNumbers?: string[];
  foundSerialNumbers?: string[];
  additions?: ReconcileCountAdditionInput[];
}

export interface InventoryCountLotResult {
  lotId?: string;
  lotNumber: string;
  expirationDate?: string;
  quantityBefore: number;
  countedQuantity: number;
  delta: number;
  foundSerialNumbers: string[];
  missingSerialNumbers: string[];
  addedSerialNumbers: string[];
}

export interface InventoryCountResult {
  countId: string;
  createdAt: string;
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  locationName: string;
  performedByName: string;
  quantityBefore: number;
  countedQuantity: number;
  quantityAfter: number;
  delta: number;
  lots: InventoryCountLotResult[];
  movementIds: string[];
}

export interface InventoryAdjustmentRepository {
  getById(id: string): Promise<InventoryAdjustment | null>;
  getByNumber(tenantId: string, number: string): Promise<InventoryAdjustment | null>;
  query(filters?: InventoryAdjustmentFilters): Promise<InventoryAdjustment[]>;
  create(input: CreateInventoryAdjustmentInput): Promise<InventoryAdjustment>;
  registerStockAdjustment(
    input: RegisterInventoryAdjustmentStockInput,
  ): Promise<RegisterInventoryAdjustmentStockResult>;
  /** Solo modo API: lotes existentes con disponibilidad real (lookup bajo demanda). */
  listAvailableLots(input: ListAdjustmentLotsInput): Promise<AdjustmentLotOption[]>;
  /** Solo modo API: series AVAILABLE existentes. */
  listAvailableSerials(input: ListAdjustmentSerialsInput): Promise<AdjustmentSerialOption[]>;
  /** Solo modo API: precheck UX de series NUEVAS (una request batch). */
  validateNewSerials(input: ValidateNewSerialsInput): Promise<SerialValidationResult>;
  /** Solo modo API: estado FISICO para un conteo trazable. */
  getCountSnapshot(input: GetCountSnapshotInput): Promise<InventoryCountSnapshot>;
  /** Solo modo API: una unica request que aplica el conteo trazable. */
  reconcileCount(input: ReconcileCountInput): Promise<InventoryCountResult>;
}
