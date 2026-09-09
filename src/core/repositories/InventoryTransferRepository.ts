import type { InventoryTransfer, InventoryTransferItem } from "@/core/entities";
import type { InventoryTransferStatus } from "@/core/enums";

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
  sourceRequestIds?: string[];
  notes?: string;
  preparedByUserId?: string;
  items: CreateInventoryTransferItemInput[];
}

export interface DispatchInventoryTransferItemInput {
  itemId: string;
  dispatchedQuantity: number;
}

export interface DispatchInventoryTransferInput {
  dispatchedByUserId?: string;
  items: DispatchInventoryTransferItemInput[];
}

export interface ReceiveInventoryTransferItemInput {
  itemId: string;
  receivedQuantity: number;
}

export interface ReceiveInventoryTransferInput {
  receivedByUserId?: string;
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
  cancel(id: string, reason?: string): Promise<InventoryTransferWithItems>;
}
