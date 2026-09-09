import type { InventoryTransferStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface InventoryTransfer {
  id: string;
  tenantId: string;
  number: string;
  sourceBranchId: string;
  destinationBranchId: string;
  status: InventoryTransferStatus;
  sourceRequestIds?: string[];
  notes?: string;
  preparedByUserId?: string;
  dispatchedByUserId?: string;
  receivedByUserId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  dispatchedAt?: ISODateString;
  receivedAt?: ISODateString;
  cancelledAt?: ISODateString;
}
