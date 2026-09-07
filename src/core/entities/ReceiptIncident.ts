import type { ISODateString } from "@/core/types/common.types";

export interface ReceiptIncident {
  id: string;
  receiptId: string;
  receiptLineId?: string;
  incidentTypeId: string;
  description: string;
  quantityAffected?: number;
  createdByUserId: string;
  createdAt: ISODateString;
}
