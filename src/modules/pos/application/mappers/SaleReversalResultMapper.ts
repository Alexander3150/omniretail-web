import type { SaleReversalResult } from "@/core/repositories";
import type { SaleReversalResultDto } from "@/modules/pos/application/dto/SaleReversalResultDto";

export function mapSaleReversalResult(result: SaleReversalResult): SaleReversalResultDto {
  const operation = result.returnRequest ?? result.void;
  if (!operation) throw new Error("La reversion no contiene una operacion procesada.");
  return {
    saleId: result.sale.id,
    documentNumber: result.sale.number,
    saleStatus: result.sale.status,
    operationType: result.returnRequest ? "return" : "void",
    operationId: operation.id,
    refundTotal: operation.refundTotal,
    refunds: result.refunds.map((refund) => ({
      paymentId: refund.paymentId,
      method: refund.method,
      amount: refund.amount,
    })),
    inventoryMovementIds: result.inventoryMovements.map((movement) => movement.id),
    cashMovementId: result.cashMovement?.id,
    creditNote: {
      id: result.creditNote.id,
      documentNumber: result.creditNote.documentNumber,
      amount: result.creditNote.amount,
    },
    idempotent: result.idempotent,
  };
}
