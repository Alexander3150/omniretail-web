import type { ReceiptStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface Receipt {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  purchaseOrderId?: string;
  supplierId: string;
  status: ReceiptStatus;
  /** Stable idempotency identity for a completed receiving confirmation. */
  confirmationId?: string;
  confirmationFingerprint?: string;
  receivedByUserId?: string;
  receivedAt?: ISODateString;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
