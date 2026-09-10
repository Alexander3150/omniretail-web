import type { ISODateString } from "@/core/types/common.types";

export interface ReceiptIncidentEvidence {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}

export interface ReceiptIncident {
  id: string;
  receiptId: string;
  receiptLineId?: string;
  incidentTypeId: string;
  description: string;
  quantityAffected?: number;
  evidence?: ReceiptIncidentEvidence[];
  createdByUserId: string;
  createdAt: ISODateString;
}
