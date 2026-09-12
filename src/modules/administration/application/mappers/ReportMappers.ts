import type { InventoryMovement, Payment, PurchaseOrder, Sale } from "@/core/entities";
import type {
  MovementReportRow,
  PaymentReportRow,
  PurchasesReportRow,
  SalesReportRow,
} from "@/modules/administration/application/dto/ReportDto";

export function toSalesReportRow(
  sale: Sale,
  branchNames: ReadonlyMap<string, string>,
): SalesReportRow {
  return {
    number: sale.number,
    date: sale.createdAt,
    branchId: sale.branchId,
    branchName: branchNames.get(sale.branchId) ?? sale.branchId,
    status: sale.status,
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    taxTotal: sale.taxTotal,
    total: sale.total,
  };
}

export function toPurchasesReportRow(
  order: PurchaseOrder,
  branchNames: ReadonlyMap<string, string>,
  supplierNames: ReadonlyMap<string, string>,
): PurchasesReportRow {
  return {
    number: order.number,
    date: order.createdAt,
    branchId: order.branchId,
    branchName: branchNames.get(order.branchId) ?? order.branchId,
    supplierId: order.supplierId,
    supplierName: supplierNames.get(order.supplierId) ?? order.supplierId,
    status: order.status,
    subtotal: order.subtotal,
    total: order.total,
  };
}

export function toMovementReportRow(
  movement: InventoryMovement,
  branchNames: ReadonlyMap<string, string>,
  productNames: ReadonlyMap<string, string>,
): MovementReportRow {
  return {
    date: movement.createdAt,
    branchId: movement.branchId,
    branchName: branchNames.get(movement.branchId) ?? movement.branchId,
    productId: movement.productId,
    productName: productNames.get(movement.productId) ?? movement.productId,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
  };
}

export function toPaymentReportRow(payment: Payment): PaymentReportRow {
  return {
    date: payment.createdAt,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    reference: payment.reference ?? "—",
    origin: payment.orderId ? "Orden" : payment.saleId ? "Venta" : "—",
  };
}
