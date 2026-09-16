import type { InventoryMovement, Order, PickingOrder } from "@/core/entities";
import { InventoryReservationStatus, PickingItemStatus, ProductType } from "@/core/enums";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { consumeInventoryReservationInDatabase } from "@/infrastructure/mock/repositories/inventoryReservationMutations";

/** Commits physical stock only at the authoritative fulfillment boundary. */
export function commitPickedOrderInventoryInDatabase(
  db: MockDatabase,
  input: {
    order: Order;
    picking: PickingOrder;
    actorUserId: string;
    operationId: string;
    referenceType: "order" | "dispatch";
    referenceId: string;
    reason: string;
  },
  dependencies: { id(prefix: string): string; now(): string },
): InventoryMovement[] {
  const movements: InventoryMovement[] = [];
  const items = db.pickingItems.filter((item) => item.pickingOrderId === input.picking.id);
  if (items.length === 0) throw new Error(`Picking has no items: ${input.picking.id}`);
  for (const item of items) {
    const product = db.products.find((entry) => entry.id === item.productId &&
      entry.tenantId === input.order.tenantId);
    if (!product) throw new Error(`Product not found for Picking: ${item.productId}`);
    if (item.pickedQuantity !== item.requestedQuantity || item.status !== PickingItemStatus.completed) {
      throw new Error(`Picking item is incomplete: ${item.id}`);
    }
    if (product.productType !== ProductType.physical || !product.tracking.stock) continue;
    const matches = db.inventoryReservations.filter((entry) =>
      entry.tenantId === input.order.tenantId && entry.branchId === input.order.branchId &&
      entry.orderId === input.order.id && entry.orderItemId === item.orderItemId &&
      entry.productId === item.productId);
    if (matches.length !== 1) throw new Error(`Expected one reservation for Picking item: ${item.id}`);
    const reservation = matches[0];
    // Local databases created by older releases may already have consumed stock at Picking.
    if (reservation.status === InventoryReservationStatus.consumed) {
      if (reservation.allocations.some((entry) => entry.consumedQuantity !== entry.reservedQuantity)) {
        throw new Error(`Partially consumed legacy reservation: ${reservation.id}`);
      }
      continue;
    }
    if (reservation.status !== InventoryReservationStatus.active) {
      throw new Error(`Reservation is not active: ${reservation.id}`);
    }
    const picked = item.pickedAllocations ?? [];
    if (picked.reduce((total, entry) => total + entry.quantity, 0) !== item.requestedQuantity) {
      throw new Error(`Picking allocations are incomplete: ${item.id}`);
    }
    const allocationsConsumed = reservation.allocations.map((allocation) => ({
      balanceId: allocation.balanceId,
      quantity: picked.filter((entry) => entry.balanceId === allocation.balanceId)
        .reduce((total, entry) => total + entry.quantity, 0),
    }));
    if (allocationsConsumed.some((entry, index) =>
      entry.quantity !== reservation.allocations[index].reservedQuantity)) {
      throw new Error(`Picking allocations conflict with reservation: ${item.id}`);
    }
    const serialNumbers = product.tracking.serial ? item.serialNumbers ?? [] : undefined;
    if (product.tracking.serial && serialNumbers?.length !== item.requestedQuantity) {
      throw new Error(`Picking serial selection is incomplete: ${item.id}`);
    }
    const pickedLots = product.tracking.lot ? Array.from(picked.reduce((grouped, entry) => {
      if (!entry.lotId) throw new Error(`Picking lot selection is incomplete: ${item.id}`);
      const key = `${entry.balanceId}:${entry.lotId}`;
      const current = grouped.get(key);
      grouped.set(key, { balanceId: entry.balanceId, lotId: entry.lotId,
        quantity: (current?.quantity ?? 0) + entry.quantity });
      return grouped;
    }, new Map<string, { balanceId: string; lotId: string; quantity: number }>()).values()) : undefined;
    const consumed = consumeInventoryReservationInDatabase(db, {
      tenantId: input.order.tenantId,
      branchId: input.order.branchId,
      reservationId: reservation.id,
      allocationsConsumed,
      serialNumbers,
      operationId: `${input.operationId}:${reservation.id}`,
      performedByUserId: input.actorUserId,
    }, dependencies, {
      pickedLots,
      movement: { reason: input.reason, referenceType: input.referenceType, referenceId: input.referenceId },
    });
    if (consumed.reservation.status !== InventoryReservationStatus.consumed) {
      throw new Error(`Reservation was not fully consumed: ${reservation.id}`);
    }
    movements.push(...consumed.inventoryMovements);
  }
  return movements;
}
