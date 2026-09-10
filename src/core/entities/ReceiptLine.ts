import type { ReceiptLineStatus } from "@/core/enums";

export interface ReceiptLine {
  id: string;
  receiptId: string;
  productId: string;
  orderedQuantity?: number;
  receivedQuantity: number;
  rejectedQuantity?: number;
  status: ReceiptLineStatus;
  locationId?: string;
  lotId?: string;
  lotNumber?: string;
  expirationDate?: string;
  serialNumbers?: string[];
  notes?: string;
}
