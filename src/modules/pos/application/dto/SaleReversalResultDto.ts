import type { PaymentMethod, SaleStatus } from "@/core/enums";

export interface SaleReversalResultDto {
  saleId: string;
  documentNumber: string;
  saleStatus: SaleStatus;
  operationType: "return" | "void";
  operationId: string;
  refundTotal: number;
  refunds: Array<{
    paymentId: string;
    method: Exclude<PaymentMethod, "mixed">;
    amount: number;
  }>;
  inventoryMovementIds: string[];
  cashMovementId?: string;
  creditNote: {
    id: string;
    documentNumber: string;
    amount: number;
  };
  idempotent: boolean;
}
