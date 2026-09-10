import type { InventoryMovement, InventoryReservation, PickingItem } from "@/core/entities";
import {
  InventoryReservationStatus,
  PickingItemStatus,
  PickingStatus,
  ProductType,
} from "@/core/enums";
import type { PickingRepository, UpdatePickingItemInput } from "@/core/repositories";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import {
  consumeInventoryReservationInDatabase,
  getInventoryReservationAllocationRemaining,
} from "@/infrastructure/mock/repositories/inventoryReservationMutations";

interface PickingItemMutationResult {
  item: PickingItem;
  tenantId: string;
  branchId: string;
  itemChanged: boolean;
  reservation?: InventoryReservation;
  inventoryMovements: InventoryMovement[];
  inventoryChanged: boolean;
}

export class MockPickingRepository extends BaseMockRepository implements PickingRepository {
  async getAll() {
    return this.read((db) => db.pickingOrders);
  }

  async getById(id: string) {
    return this.read((db) => db.pickingOrders.find((item) => item.id === id) ?? null);
  }

  async getByOrder(orderId: string) {
    return this.read((db) => db.pickingOrders.find((item) => item.orderId === orderId) ?? null);
  }

  async getQueue() {
    return this.read((db) =>
      db.pickingOrders.filter((item) =>
        [PickingStatus.pending, PickingStatus.assigned, PickingStatus.in_progress].includes(
          item.status,
        ),
      ),
    );
  }

  async create(input: Parameters<PickingRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("picking"), createdAt: now, updatedAt: now };
      db.pickingOrders.push(created);
      return created;
    });
    this.emit("picking.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }

  async assign(id: string, userId: string) {
    const item = this.store.mutate((db) =>
      this.updateById(
        db.pickingOrders,
        id,
        { assignedUserId: userId, status: PickingStatus.assigned },
        "PickingOrder",
      ),
    );
    this.emit("picking.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }

  async updateStatus(id: string, status: PickingStatus) {
    const result = this.store.transact((db) => {
      const item = db.pickingOrders.find((entry) => entry.id === id);
      if (!item) throw this.missing("PickingOrder", id);
      if (status === PickingStatus.completed) this.assertPickingOrderCompletable(item.id, db);
      if (item.status === status) return { item, changed: false };
      item.status = status;
      item.updatedAt = this.now();
      return { item, changed: true };
    });
    if (result.changed) {
      this.emit("picking.changed", {
        entityId: result.item.id,
        tenantId: result.item.tenantId,
        action: "status_changed",
      });
    }
    return result.item;
  }

  async updateItem(id: string, input: UpdatePickingItemInput) {
    const result = this.store.transact<PickingItemMutationResult>((db) => {
      const itemIndex = db.pickingItems.findIndex((entry) => entry.id === id);
      if (itemIndex < 0) throw this.missing("PickingItem", id);
      const current = db.pickingItems[itemIndex];
      const context = this.getPickingItemContext(current, db);

      if (input.pickedQuantity === undefined) {
        if (
          context.product.productType === ProductType.physical &&
          context.product.tracking.stock
        ) {
          const reservation = this.getLinkedReservation(current, context.pickingOrder, db);
          if (reservation) {
            this.assertPickingItemLocationIsUnchanged(current, input);
          }
        }
        const status = this.getValidatedPickingItemStatus(
          current.pickedQuantity,
          current.requestedQuantity,
          input.status,
        );
        const updated = { ...current, ...input, status };
        const itemChanged = JSON.stringify(updated) !== JSON.stringify(current);
        db.pickingItems[itemIndex] = updated;
        return {
          item: updated,
          tenantId: context.pickingOrder.tenantId,
          branchId: context.pickingOrder.branchId,
          itemChanged,
          inventoryMovements: [],
          inventoryChanged: false,
        };
      }

      this.assertPickingQuantityInput(input);
      const fingerprint = getPickingItemUpdateFingerprint(id, input);
      const existingOperation = db.pickingItemUpdateOperations.find(
        (operation) =>
          operation.tenantId === context.pickingOrder.tenantId &&
          operation.operationId === input.operationId,
      );
      if (existingOperation) {
        if (
          existingOperation.pickingItemId !== id ||
          existingOperation.fingerprint !== fingerprint
        ) {
          throw new Error(`Picking item operation conflict: ${input.operationId}`);
        }
        return {
          item: existingOperation.resultItem,
          tenantId: existingOperation.tenantId,
          branchId: existingOperation.branchId,
          itemChanged: false,
          inventoryMovements: [],
          inventoryChanged: false,
        };
      }

      const targetQuantity = input.pickedQuantity;
      this.assertPickingQuantityChange(current, targetQuantity);
      const delta = targetQuantity - current.pickedQuantity;
      if (delta > 0) this.assertPickingOrderAllowsIncrease(context.pickingOrder.status);

      const nextStatus = this.getValidatedPickingItemStatus(
        targetQuantity,
        current.requestedQuantity,
        input.status,
      );
      let reservation: InventoryReservation | undefined;
      let inventoryMovements: InventoryMovement[] = [];
      let inventoryChanged = false;

      if (
        context.product.productType === ProductType.physical &&
        context.product.tracking.stock
      ) {
        reservation = this.getRequiredReservation(current, context.pickingOrder, db);
        this.assertPickingItemLocationIsUnchanged(current, input);
        if (delta > 0) {
          this.assertPickingItemLocationMatchesReservation(current, reservation);
        }
        if (delta > 0) {
          const allocationsConsumed = planPersistedReservationConsumption(reservation, delta);
          const consumption = consumeInventoryReservationInDatabase(
            db,
            {
              tenantId: context.pickingOrder.tenantId,
              branchId: context.pickingOrder.branchId,
              reservationId: reservation.id,
              allocationsConsumed,
              operationId: input.operationId,
              performedByUserId: input.performedByUserId,
            },
            { id: (prefix) => this.id(prefix), now: () => this.now() },
          );
          reservation = consumption.reservation;
          inventoryMovements = consumption.inventoryMovements;
          inventoryChanged = consumption.changed;
        }
      }

      const { operationId, performedByUserId, ...itemInput } = input;
      void performedByUserId;
      const updated: PickingItem = {
        ...current,
        ...itemInput,
        pickedQuantity: targetQuantity,
        status: nextStatus,
      };
      db.pickingItems[itemIndex] = updated;
      db.pickingItemUpdateOperations.push({
        id: this.id("picking-item-update-operation"),
        tenantId: context.pickingOrder.tenantId,
        branchId: context.pickingOrder.branchId,
        pickingOrderId: context.pickingOrder.id,
        pickingItemId: current.id,
        operationId,
        fingerprint,
        resultItem: structuredClone(updated),
        createdAt: this.now(),
      });

      return {
        item: updated,
        tenantId: context.pickingOrder.tenantId,
        branchId: context.pickingOrder.branchId,
        itemChanged: JSON.stringify(updated) !== JSON.stringify(current),
        reservation,
        inventoryMovements,
        inventoryChanged,
      };
    });

    this.emitPickingItemChanges(result);
    return result.item;
  }

  private getPickingItemContext(item: PickingItem, db: MockDatabase) {
    const pickingOrder = db.pickingOrders.find((entry) => entry.id === item.pickingOrderId);
    if (!pickingOrder) throw this.missing("PickingOrder", item.pickingOrderId);
    const order = db.orders.find(
      (entry) =>
        entry.id === pickingOrder.orderId &&
        entry.tenantId === pickingOrder.tenantId &&
        entry.branchId === pickingOrder.branchId,
    );
    if (!order) throw new Error(`Order not found for PickingOrder: ${pickingOrder.id}`);
    const orderItem = order.items.find(
      (entry) => entry.id === item.orderItemId && entry.orderId === order.id,
    );
    if (!orderItem || orderItem.productId !== item.productId) {
      throw new Error(`OrderItem conflict for PickingItem: ${item.id}`);
    }
    const product = db.products.find(
      (entry) => entry.id === item.productId && entry.tenantId === pickingOrder.tenantId,
    );
    if (!product) throw new Error(`Product not found for PickingItem: ${item.id}`);
    return { pickingOrder, product };
  }

  private getRequiredReservation(
    item: PickingItem,
    pickingOrder: { id: string; tenantId: string; branchId: string; orderId: string },
    db: MockDatabase,
  ): InventoryReservation {
    const reservation = this.getLinkedReservation(item, pickingOrder, db);
    if (!reservation) {
      throw new Error(`InventoryReservation not found for PickingItem: ${item.id}`);
    }
    return reservation;
  }

  private getLinkedReservation(
    item: PickingItem,
    pickingOrder: { id: string; tenantId: string; branchId: string; orderId: string },
    db: MockDatabase,
  ): InventoryReservation | undefined {
    const reservation = db.inventoryReservations.find(
      (entry) =>
        entry.tenantId === pickingOrder.tenantId && entry.orderItemId === item.orderItemId,
    );
    if (!reservation) return undefined;
    if (
      reservation.branchId !== pickingOrder.branchId ||
      reservation.orderId !== pickingOrder.orderId ||
      reservation.productId !== item.productId
    ) {
      throw new Error(`InventoryReservation conflict for PickingItem: ${item.id}`);
    }
    return reservation;
  }

  private assertPickingOrderAllowsIncrease(status: PickingStatus): void {
    if ([PickingStatus.cancelled, PickingStatus.completed].includes(status)) {
      throw new Error(`Cannot increase PickingItem for terminal PickingOrder: ${status}`);
    }
  }

  private assertPickingItemLocationIsUnchanged(
    item: PickingItem,
    input: UpdatePickingItemInput,
  ): void {
    if (input.locationId !== undefined && input.locationId !== item.locationId) {
      throw new Error(`Picking location reallocation is not supported: ${item.id}`);
    }
  }

  private assertPickingItemLocationMatchesReservation(
    item: PickingItem,
    reservation: InventoryReservation,
  ): void {
    if (
      item.locationId !== undefined &&
      !reservation.allocations.some((allocation) => allocation.locationId === item.locationId)
    ) {
      throw new Error(`PickingItem location conflicts with reservation: ${item.id}`);
    }
  }

  private assertPickingQuantityInput(
    input: UpdatePickingItemInput & { pickedQuantity: number },
  ): void {
    if (!input.operationId.trim()) throw new Error("Picking operationId is required");
    if (!input.performedByUserId.trim()) throw new Error("Picking performedByUserId is required");
  }

  private assertPickingQuantityChange(item: PickingItem, targetQuantity: number): void {
    if (!Number.isFinite(targetQuantity) || targetQuantity < 0) {
      throw new Error(`Picking pickedQuantity must be non-negative: ${item.id}`);
    }
    if (targetQuantity > item.requestedQuantity) {
      throw new Error(`Picking pickedQuantity exceeds requestedQuantity: ${item.id}`);
    }
    if (targetQuantity < item.pickedQuantity) {
      throw new Error(`Picking pickedQuantity cannot decrease: ${item.id}`);
    }
  }

  private getValidatedPickingItemStatus(
    pickedQuantity: number,
    requestedQuantity: number,
    requestedStatus?: PickingItemStatus,
  ): PickingItemStatus {
    const derivedStatus = getPickingItemStatus(pickedQuantity, requestedQuantity);
    if (
      requestedStatus !== undefined &&
      requestedStatus !== PickingItemStatus.incident &&
      requestedStatus !== derivedStatus
    ) {
      throw new Error(
        `PickingItem status ${requestedStatus} conflicts with picked quantity ${pickedQuantity}`,
      );
    }
    return requestedStatus === PickingItemStatus.incident
      ? PickingItemStatus.incident
      : derivedStatus;
  }

  private assertPickingOrderCompletable(pickingOrderId: string, db: MockDatabase): void {
    const pickingOrder = db.pickingOrders.find((entry) => entry.id === pickingOrderId);
    if (!pickingOrder) throw this.missing("PickingOrder", pickingOrderId);
    db.pickingItems
      .filter((item) => item.pickingOrderId === pickingOrderId)
      .forEach((item) => {
        const context = this.getPickingItemContext(item, db);
        if (context.product.productType !== ProductType.physical) return;
        if (
          item.pickedQuantity !== item.requestedQuantity ||
          item.status !== PickingItemStatus.completed
        ) {
          throw new Error(`PickingItem is not completed: ${item.id}`);
        }
        if (!context.product.tracking.stock) return;
        const reservation = this.getRequiredReservation(item, pickingOrder, db);
        const remaining = reservation.allocations.reduce(
          (total, allocation) =>
            total + getInventoryReservationAllocationRemaining(allocation),
          0,
        );
        if (reservation.status !== InventoryReservationStatus.consumed || remaining !== 0) {
          throw new Error(`InventoryReservation is not fully consumed: ${reservation.id}`);
        }
      });
  }

  private emitPickingItemChanges(result: PickingItemMutationResult): void {
    if (result.inventoryChanged && result.reservation) {
      result.inventoryMovements.forEach((movement) =>
        this.emitSafely("inventory.changed", {
          entityId: movement.id,
          tenantId: movement.tenantId,
          branchId: movement.branchId,
          productId: movement.productId,
          action: "created",
        }),
      );
      this.emitSafely("stock.changed", {
        entityId: result.reservation.id,
        tenantId: result.reservation.tenantId,
        branchId: result.reservation.branchId,
        productId: result.reservation.productId,
        action: "updated",
        metadata: { entity: "InventoryReservation", status: result.reservation.status },
      });
    }
    if (result.itemChanged) {
      this.emitSafely("picking.changed", {
        entityId: result.item.pickingOrderId,
        tenantId: result.tenantId,
        branchId: result.branchId,
        action: "updated",
      });
    }
  }

  private emitSafely(event: DataEventName, payload: DataEventPayload): void {
    try {
      this.emit(event, payload);
    } catch {
      // The transaction is already committed; listener failures cannot roll it back.
    }
  }
}

function getPickingItemStatus(
  pickedQuantity: number,
  requestedQuantity: number,
): PickingItemStatus {
  if (pickedQuantity === 0) return PickingItemStatus.pending;
  if (pickedQuantity === requestedQuantity) return PickingItemStatus.completed;
  return PickingItemStatus.partial;
}

function planPersistedReservationConsumption(
  reservation: InventoryReservation,
  quantity: number,
) {
  let remainingQuantity = quantity;
  const allocationsConsumed = reservation.allocations.flatMap((allocation) => {
    if (remainingQuantity <= 0) return [];
    const available = getInventoryReservationAllocationRemaining(allocation);
    const consumedQuantity = Math.min(available, remainingQuantity);
    if (consumedQuantity <= 0) return [];
    remainingQuantity -= consumedQuantity;
    return [{ balanceId: allocation.balanceId, quantity: consumedQuantity }];
  });
  if (remainingQuantity > 0) {
    throw new Error(`Insufficient remaining reservation: ${reservation.id}`);
  }
  return allocationsConsumed;
}

function getPickingItemUpdateFingerprint(id: string, input: UpdatePickingItemInput): string {
  return JSON.stringify({
    pickingItemId: id,
    pickedQuantity: input.pickedQuantity,
    status: input.status ?? null,
    locationId: input.locationId ?? null,
    lotId: input.lotId ?? null,
    serialNumbers: input.serialNumbers ?? null,
    performedByUserId: input.performedByUserId,
  });
}
