import type { Order } from "@/core/entities";
import type { OrderStatus } from "@/core/enums";

/**
 * Vista de solo lectura para "Mis pedidos": expone unicamente lo que la
 * pantalla necesita. Order trae campos internos (idempotencyKey/
 * idempotencyFingerprint, branchId, trackingToken, etc.) que no tienen
 * razon de llegar a este boundary de cliente.
 */
export interface CustomerOrderSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  itemCount: number;
  total: number;
  createdAt: string;
}

export function toCustomerOrderSummaryDto(order: Order): CustomerOrderSummaryDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    itemCount: order.items.length,
    total: order.total,
    createdAt: order.createdAt,
  };
}
