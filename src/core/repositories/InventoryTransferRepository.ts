import type { InventoryTransfer, InventoryTransferItem } from "@/core/entities";
import type { InventoryTransferReason, InventoryTransferStatus } from "@/core/enums";

export interface InventoryTransferFilters {
  tenantId?: string;
  sourceBranchId?: string;
  destinationBranchId?: string;
  status?: InventoryTransferStatus;
}

export interface CreateInventoryTransferItemInput {
  productId: string;
  sourceRequestId?: string;
  requestedQuantity: number;
  dispatchedQuantity?: number;
  receivedQuantity?: number;
}

export interface CreateInventoryTransferInput {
  tenantId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  operationId: string;
  sourceRequestIds?: string[];
  reason?: InventoryTransferReason;
  notes?: string;
  preparedByUserId: string;
  items: CreateInventoryTransferItemInput[];
}

export interface DispatchInventoryTransferItemInput {
  itemId: string;
  dispatchedQuantity: number;
}

export interface DispatchInventoryTransferInput {
  dispatchedByUserId: string;
  operationId: string;
  items: DispatchInventoryTransferItemInput[];
}

export interface ReceiveInventoryTransferItemInput {
  itemId: string;
  receivedQuantity: number;
  locationId: string;
}

export interface ReceiveInventoryTransferInput {
  receivedByUserId: string;
  confirmationId: string;
  items: ReceiveInventoryTransferItemInput[];
}

export interface InventoryTransferWithItems {
  transfer: InventoryTransfer;
  items: InventoryTransferItem[];
}

export interface InventoryTransferRepository {
  getById(id: string): Promise<InventoryTransferWithItems | null>;
  getByNumber(tenantId: string, number: string): Promise<InventoryTransferWithItems | null>;
  query(filters?: InventoryTransferFilters): Promise<InventoryTransferWithItems[]>;
  create(input: CreateInventoryTransferInput): Promise<InventoryTransferWithItems>;
  markInTransit(
    id: string,
    input: DispatchInventoryTransferInput,
  ): Promise<InventoryTransferWithItems>;
  markReceived(
    id: string,
    input: ReceiveInventoryTransferInput,
  ): Promise<InventoryTransferWithItems>;
  cancel(id: string, input: {
    reason: string;
    actorUserId: string;
    operationId: string;
  }): Promise<InventoryTransferWithItems>;
}
