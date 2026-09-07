import type { ReturnStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface ReturnRequest {
  id: string;
  tenantId: string;
  saleId: string;
  status: ReturnStatus;
  reason: string;
  createdByUserId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
