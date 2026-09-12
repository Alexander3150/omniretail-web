import type {
  InventoryMovement,
  InventoryReservation,
  PickingIncident,
  PickingItem,
} from "@/core/entities";
import {
  InventoryReservationStatus,
  OrderStatus,
  PickingIncidentStatus,
  PickingItemStatus,
  PickingStatus,
  ProductType,
  UserStatus,
  UserType,
} from "@/core/enums";
import type { PickingRepository, UpdatePickingItemInput } from "@/core/repositories";
import type {
  DataEventArguments,
  DataEventName,
  DataEventPayload,
} from "@/core/types/events.types";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import type { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import {
  consumeInventoryReservationInDatabase,
  getInventoryReservationAllocationRemaining,
} from "@/infrastructure/mock/repositories/inventoryReservationMutations";

interface PickingItemMutationResult {
  item: PickingItem;
  tenantId: string;
  branchId: string;
  orderId: string;
  itemChanged: boolean;
  reservation?: InventoryReservation;
  inventoryMovements: InventoryMovement[];
  inventoryChanged: boolean;
}

export interface MockPickingRepositoryTestHooks {
  afterPickingCompleted?: () => void;
}

export class MockPickingRepository extends BaseMockRepository implements PickingRepository {
  constructor(
    store: MockDatabaseStore,
    eventBus: DataEventBus,
    private readonly testHooks: MockPickingRepositoryTestHooks = {},
  ) {
    super(store, eventBus);
  }

  async getById(scope: Parameters<PickingRepository["getById"]>[0], pickingOrderId: string) {
    return this.read(
      (db) =>
        db.pickingOrders.find(
          (item) =>
            item.id === pickingOrderId &&
            item.tenantId === scope.tenantId &&
            item.branchId === scope.branchId,
        ) ?? null,
    );
  }

  async getByOrder(scope: Parameters<PickingRepository["getByOrder"]>[0], orderId: string) {
    return this.read(
      (db) =>
        db.pickingOrders.find(
          (item) =>
            item.orderId === orderId &&
            item.tenantId === scope.tenantId &&
            item.branchId === scope.branchId,
        ) ?? null,
    );
  }

  async getQueue(scope: Parameters<PickingRepository["getQueue"]>[0]) {
    return this.read((db) =>
      db.pickingOrders.filter(
        (item) =>
          item.tenantId === scope.tenantId &&
          item.branchId === scope.branchId &&
          [PickingStatus.pending, PickingStatus.assigned, PickingStatus.in_progress].includes(
            item.status,
          ),
      ),
    );
  }

  async getItems(scope: Parameters<PickingRepository["getItems"]>[0], pickingOrderId: string) {
    return this.read((db) => {
      this.findScopedPickingOrder(db, scope, pickingOrderId);
      return db.pickingItems.filter((item) => item.pickingOrderId === pickingOrderId);
    });
  }

  async create(input: Parameters<PickingRepository["create"]>[0]) {
    const item = this.store.transact((db) => {
      const existing = db.pickingOrders.find(
        (entry) =>
          entry.tenantId === input.tenantId &&
          entry.branchId === input.branchId &&
          entry.orderId === input.orderId,
      );
      if (existing) return existing;
      const order = db.orders.find(
        (entry) =>
          entry.id === input.orderId &&
          entry.tenantId === input.tenantId &&
          entry.branchId === input.branchId,
      );
      if (!order) throw new Error(`Order not found for PickingOrder: ${input.orderId}`);
      const now = this.now();
      const created = {
        ...input,
        id: this.id("picking"),
        status: PickingStatus.pending,
        createdAt: now,
        updatedAt: now,
      };
      db.pickingOrders.push(created);
      order.items.forEach((orderItem) => {
        const demands = orderItem.fulfillmentComponents ?? [
          { productId: orderItem.productId, quantity: orderItem.quantity },
        ];
        demands.forEach((demand) => {
          const product = db.products.find(
            (entry) => entry.id === demand.productId && entry.tenantId === input.tenantId,
          );
          if (!product) throw new Error(`Product not found for PickingItem: ${demand.productId}`);
          if (product.productType !== ProductType.physical) return;
          if (
            db.pickingItems.some(
              (entry) =>
                entry.pickingOrderId === created.id &&
                entry.orderItemId === orderItem.id &&
                entry.productId === demand.productId,
            )
          ) {
            return;
          }
          const reservation = db.inventoryReservations.find(
            (entry) =>
              entry.tenantId === input.tenantId &&
              entry.orderItemId === orderItem.id &&
              entry.productId === demand.productId,
          );
          if (product.tracking.stock && !reservation) {
            throw new Error(`Reservation not found for PickingItem: ${orderItem.id}`);
          }
          db.pickingItems.push({
            id: this.id("picking-item"),
            pickingOrderId: created.id,
            orderItemId: orderItem.id,
            productId: demand.productId,
            requestedQuantity: demand.quantity,
            pickedQuantity: 0,
            locationId: reservation?.allocations[0]?.locationId,
            status: PickingItemStatus.pending,
          });
        });
      });
      return created;
    });
    this.emitPickingChanged(item, "created");
    return item;
  }

  async assign(input: Parameters<PickingRepository["assign"]>[0]) {
    const result = this.store.transact((db) => {
      const pickingOrder = this.findScopedPickingOrder(db, input, input.pickingOrderId);
      this.assertActor(input.actorUserId, input.tenantId, db);
      if ([PickingStatus.completed, PickingStatus.cancelled].includes(pickingOrder.status)) {
        throw new Error(`Cannot assign terminal PickingOrder: ${pickingOrder.id}`);
      }
      if (pickingOrder.assignedUserId === input.actorUserId) {
        return { pickingOrder, idempotent: true, changed: false };
      }
      if (pickingOrder.assignedUserId) {
        throw new Error(`PickingOrder assignment conflict: ${pickingOrder.id}`);
      }
      const hasProgress = db.pickingItems.some(
        (item) => item.pickingOrderId === pickingOrder.id && item.pickedQuantity > 0,
      );
      pickingOrder.assignedUserId = input.actorUserId;
      pickingOrder.status = hasProgress ? PickingStatus.in_progress : PickingStatus.assigned;
      pickingOrder.updatedAt = this.now();
      return { pickingOrder, idempotent: false, changed: true };
    });
    if (result.changed) this.emitPickingChanged(result.pickingOrder, "updated");
    return { pickingOrder: result.pickingOrder, idempotent: result.idempotent };
  }

  async release(input: Parameters<PickingRepository["release"]>[0]) {
    const reason = input.reason.trim();
    if (!reason) throw new Error("Picking release reason is required");
    const result = this.store.transact((db) => {
      const pickingOrder = this.findScopedPickingOrder(db, input, input.pickingOrderId);
      this.assertActor(input.actorUserId, input.tenantId, db);
      if (pickingOrder.assignedUserId !== input.actorUserId) {
        throw new Error(`Only the assigned actor can release PickingOrder: ${pickingOrder.id}`);
      }
      if ([PickingStatus.completed, PickingStatus.cancelled].includes(pickingOrder.status)) {
        throw new Error(`Cannot release terminal PickingOrder: ${pickingOrder.id}`);
      }
      const hasProgress = db.pickingItems.some(
        (item) => item.pickingOrderId === pickingOrder.id && item.pickedQuantity > 0,
      );
      const releasedAt = this.now();
      pickingOrder.assignedUserId = undefined;
      pickingOrder.status = hasProgress ? PickingStatus.in_progress : PickingStatus.pending;
      pickingOrder.updatedAt = releasedAt;
      const release = {
        id: this.id("picking-release"),
        tenantId: input.tenantId,
        branchId: input.branchId,
        pickingOrderId: pickingOrder.id,
        actorUserId: input.actorUserId,
        reason,
        releasedAt,
      };
      db.pickingAssignmentReleases.push(release);
      return { pickingOrder, release };
    });
    this.emitPickingChanged(result.pickingOrder, "updated", {
      releaseId: result.release.id,
      releasedBy: result.release.actorUserId,
    });
    return result;
  }

  async getReleaseHistory(
    scope: Parameters<PickingRepository["getReleaseHistory"]>[0],
    pickingOrderId: string,
  ) {
    return this.read((db) => {
      this.findScopedPickingOrder(db, scope, pickingOrderId);
      return db.pickingAssignmentReleases.filter(
        (release) =>
          release.tenantId === scope.tenantId &&
          release.branchId === scope.branchId &&
          release.pickingOrderId === pickingOrderId,
      );
    });
  }

  async registerIncident(input: Parameters<PickingRepository["registerIncident"]>[0]) {
    const comment = input.comment.trim();
    if (!comment) throw new Error("Picking incident comment is required");
    if (
      input.quantityAffected !== undefined &&
      (!Number.isFinite(input.quantityAffected) || input.quantityAffected <= 0)
    ) {
      throw new Error("Picking incident quantityAffected must be greater than zero");
    }
    const incident = this.store.transact((db) => {
      const pickingOrder = this.findScopedPickingOrder(db, input, input.pickingOrderId);
      this.assertActor(input.createdBy, input.tenantId, db);
      if (input.pickingLineId) {
        const line = db.pickingItems.find(
          (item) => item.id === input.pickingLineId && item.pickingOrderId === pickingOrder.id,
        );
        if (!line) throw new Error(`Picking line not found in order: ${input.pickingLineId}`);
        if (
          input.quantityAffected !== undefined &&
          input.quantityAffected > line.requestedQuantity
        ) {
          throw new Error("Picking incident quantity exceeds required quantity");
        }
      }
      const created: PickingIncident = {
        ...input,
        comment,
        id: this.id("picking-incident"),
        status: PickingIncidentStatus.open,
        createdAt: this.now(),
      };
      db.pickingIncidents.push(created);
      return created;
    });
    this.emitPickingChangedForIncident(incident, "created");
    return incident;
  }

  async getIncidents(
    scope: Parameters<PickingRepository["getIncidents"]>[0],
    pickingOrderId: string,
  ) {
    return this.read((db) => {
      this.findScopedPickingOrder(db, scope, pickingOrderId);
      return db.pickingIncidents.filter(
        (incident) =>
          incident.tenantId === scope.tenantId &&
          incident.branchId === scope.branchId &&
          incident.pickingOrderId === pickingOrderId,
      );
    });
  }

  async resolveIncident(input: Parameters<PickingRepository["resolveIncident"]>[0]) {
    const result = this.store.transact((db) => {
      this.findScopedPickingOrder(db, input, input.pickingOrderId);
      this.assertActor(input.resolvedBy, input.tenantId, db);
      const incident = db.pickingIncidents.find(
        (item) =>
          item.id === input.incidentId &&
          item.pickingOrderId === input.pickingOrderId &&
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId,
      );
      if (!incident) {
        throw new Error(`PickingIncident not found for tenant/branch: ${input.incidentId}`);
      }
      if (incident.status === PickingIncidentStatus.resolved) {
        if (incident.resolvedBy !== input.resolvedBy) {
          throw new Error(`PickingIncident resolution conflict: ${incident.id}`);
        }
        return { incident, changed: false };
      }
      incident.status = PickingIncidentStatus.resolved;
      incident.resolvedBy = input.resolvedBy;
      incident.resolvedAt = this.now();
      return { incident, changed: true };
    });
    if (result.changed) this.emitPickingChangedForIncident(result.incident, "updated");
    return result.incident;
  }

  async complete(input: Parameters<PickingRepository["complete"]>[0]) {
    const result = this.store.transact((db) => {
      const pickingOrder = this.findScopedPickingOrder(db, input, input.pickingOrderId);
      this.assertActor(input.actorUserId, input.tenantId, db);
      const order = db.orders.find(
        (item) =>
          item.id === pickingOrder.orderId &&
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId,
      );
      if (!order) throw new Error(`Order not found for PickingOrder: ${pickingOrder.id}`);
      if (pickingOrder.status === PickingStatus.completed || order.status === OrderStatus.packing) {
        if (
          pickingOrder.status === PickingStatus.completed &&
          order.status === OrderStatus.packing
        ) {
          return { pickingOrder, order, idempotent: true, changed: false };
        }
        throw new Error(`Picking completion state conflict: ${pickingOrder.id}`);
      }
      if (pickingOrder.assignedUserId !== input.actorUserId) {
        throw new Error(`Only the assigned actor can complete PickingOrder: ${pickingOrder.id}`);
      }
      if (![PickingStatus.assigned, PickingStatus.in_progress].includes(pickingOrder.status)) {
        throw new Error(`Invalid PickingOrder status for completion: ${pickingOrder.status}`);
      }
      if (order.status !== OrderStatus.picking) {
        throw new Error(`Order is not in picking: ${order.id}`);
      }
      if (
        db.pickingIncidents.some(
          (incident) =>
            incident.pickingOrderId === pickingOrder.id &&
            incident.status === PickingIncidentStatus.open,
        )
      ) {
        throw new Error(`PickingOrder has unresolved incidents: ${pickingOrder.id}`);
      }
      this.assertPickingOrderCompletable(pickingOrder.id, db);
      const now = this.now();
      pickingOrder.status = PickingStatus.completed;
      pickingOrder.completedAt = now;
      pickingOrder.updatedAt = now;
      this.testHooks.afterPickingCompleted?.();
      order.status = OrderStatus.packing;
      order.updatedAt = now;
      return { pickingOrder, order, idempotent: false, changed: true };
    });
    if (result.changed) {
      this.emitPickingChanged(result.pickingOrder, "status_changed");
      this.emitSafely("order.changed", {
        entityId: result.order.id,
        tenantId: result.order.tenantId,
        branchId: result.order.branchId,
        orderId: result.order.id,
        pickingOrderId: result.pickingOrder.id,
        action: "status_changed",
      });
    }
    return {
      pickingOrder: result.pickingOrder,
      order: result.order,
      idempotent: result.idempotent,
    };
  }

  async updateItem(input: UpdatePickingItemInput) {
    const id = input.pickingItemId;
    const result = this.store.transact<PickingItemMutationResult>((db) => {
      const itemIndex = db.pickingItems.findIndex((entry) => entry.id === id);
      if (itemIndex < 0) throw this.missing("PickingItem", id);
      const current = db.pickingItems[itemIndex];
      const context = this.getPickingItemContext(current, db);
      if (
        context.pickingOrder.id !== input.pickingOrderId ||
        context.pickingOrder.tenantId !== input.tenantId ||
        context.pickingOrder.branchId !== input.branchId
      ) {
        throw new Error(`PickingItem not found for tenant/branch: ${id}`);
      }
      this.assertActor(input.performedByUserId, input.tenantId, db);
      if (context.pickingOrder.assignedUserId !== input.performedByUserId) {
        throw new Error(`Only the assigned actor can update PickingItem: ${id}`);
      }

      if (input.pickedQuantity === undefined) {
        if (input.serialNumbers !== undefined) {
          throw new Error("Picking serial numbers can only be set through physical consumption");
        }
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
        const updated: PickingItem = {
          ...current,
          locationId: input.locationId ?? current.locationId,
          lotId: input.lotId ?? current.lotId,
          status,
        };
        const itemChanged = JSON.stringify(updated) !== JSON.stringify(current);
        db.pickingItems[itemIndex] = updated;
        return {
          item: updated,
          tenantId: context.pickingOrder.tenantId,
          branchId: context.pickingOrder.branchId,
          orderId: context.pickingOrder.orderId,
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
          orderId: context.pickingOrder.orderId,
          itemChanged: false,
          inventoryMovements: [],
          inventoryChanged: false,
        };
      }

      const targetQuantity = input.pickedQuantity;
      this.assertPickingQuantityChange(current, targetQuantity);
      const delta = targetQuantity - current.pickedQuantity;
      if (delta === 0 && input.serialNumbers !== undefined) {
        throw new Error("Picking serial numbers cannot change without physical consumption");
      }
      if (delta > 0) this.assertPickingOrderAllowsIncrease(context.pickingOrder.status);

      const nextStatus = this.getValidatedPickingItemStatus(
        targetQuantity,
        current.requestedQuantity,
        input.status,
      );
      let reservation: InventoryReservation | undefined;
      let inventoryMovements: InventoryMovement[] = [];
      let inventoryChanged = false;

      if (context.product.productType === ProductType.physical && context.product.tracking.stock) {
        reservation = this.getRequiredReservation(current, context.pickingOrder, db);
        this.assertPickingItemLocationIsUnchanged(current, input);
        if (delta > 0) {
          this.assertPickingItemLocationMatchesReservation(current, reservation);
        }
        if (delta > 0) {
          const allocationsConsumed = planPersistedReservationConsumption(reservation, delta);
          const requestedSerialNumbers = context.product.tracking.serial
            ? getNewRequestedSerialNumbers(input.serialNumbers, delta)
            : undefined;
          const consumption = consumeInventoryReservationInDatabase(
            db,
            {
              tenantId: context.pickingOrder.tenantId,
              branchId: context.pickingOrder.branchId,
              reservationId: reservation.id,
              allocationsConsumed,
              serialNumbers: requestedSerialNumbers,
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

      const {
        operationId,
        performedByUserId,
        tenantId,
        branchId,
        pickingOrderId,
        pickingItemId,
        ...itemInput
      } = input;
      void performedByUserId;
      void tenantId;
      void branchId;
      void pickingOrderId;
      void pickingItemId;
      const updated: PickingItem = {
        ...current,
        ...itemInput,
        serialNumbers: context.product.tracking.serial
          ? delta > 0
            ? [
                ...(current.serialNumbers ?? []),
                ...inventoryMovements.flatMap((movement) => {
                  const serial = db.serialNumbers.find(
                    (item) => item.id === movement.serialNumberId,
                  );
                  return serial ? [serial.serialNumber] : [];
                }),
              ]
            : current.serialNumbers
          : itemInput.serialNumbers,
        pickedQuantity: targetQuantity,
        status: nextStatus,
      };
      db.pickingItems[itemIndex] = updated;
      if (delta > 0) {
        const now = this.now();
        context.pickingOrder.status = PickingStatus.in_progress;
        context.pickingOrder.startedAt ??= now;
        context.pickingOrder.updatedAt = now;
      }
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
        orderId: context.pickingOrder.orderId,
        itemChanged: JSON.stringify(updated) !== JSON.stringify(current),
        reservation,
        inventoryMovements,
        inventoryChanged,
      };
    });

    this.emitPickingItemChanges(result);
    return result.item;
  }

  private findScopedPickingOrder(
    db: MockDatabase,
    scope: { tenantId: string; branchId: string },
    pickingOrderId: string,
  ) {
    const pickingOrder = db.pickingOrders.find(
      (item) =>
        item.id === pickingOrderId &&
        item.tenantId === scope.tenantId &&
        item.branchId === scope.branchId,
    );
    if (!pickingOrder) {
      throw new Error(`PickingOrder not found for tenant/branch: ${pickingOrderId}`);
    }
    return pickingOrder;
  }

  private assertActor(actorUserId: string, tenantId: string, db: MockDatabase): void {
    if (!actorUserId.trim()) throw new Error("Picking actor is required");
    const actor = db.users.find(
      (user) =>
        user.id === actorUserId &&
        user.tenantId === tenantId &&
        user.status === UserStatus.active &&
        user.type === UserType.employee,
    );
    if (!actor) throw new Error(`Picking actor not found for tenant: ${actorUserId}`);
  }

  private emitPickingChanged(
    pickingOrder: { id: string; tenantId: string; branchId: string; orderId: string },
    action: NonNullable<DataEventPayload["action"]>,
    metadata?: Record<string, unknown>,
  ): void {
    this.emitSafely("picking.changed", {
      entityId: pickingOrder.id,
      tenantId: pickingOrder.tenantId,
      branchId: pickingOrder.branchId,
      pickingOrderId: pickingOrder.id,
      orderId: pickingOrder.orderId,
      action,
      metadata,
    });
  }

  private emitPickingChangedForIncident(
    incident: PickingIncident,
    action: NonNullable<DataEventPayload["action"]>,
  ): void {
    const pickingOrder = this.read(
      (db) => db.pickingOrders.find((item) => item.id === incident.pickingOrderId) ?? null,
    );
    if (!pickingOrder) return;
    this.emitSafely("picking.changed", {
      entityId: pickingOrder.id,
      tenantId: incident.tenantId,
      branchId: incident.branchId,
      pickingOrderId: pickingOrder.id,
      pickingLineId: incident.pickingLineId,
      orderId: pickingOrder.orderId,
      incidentId: incident.id,
      action,
      metadata: { entity: "PickingIncident", incidentStatus: incident.status },
    });
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
    if (
      !orderItem ||
      !(
        orderItem.productId === item.productId ||
        orderItem.fulfillmentComponents?.some((component) => component.productId === item.productId)
      )
    ) {
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
        entry.tenantId === pickingOrder.tenantId &&
        entry.orderItemId === item.orderItemId &&
        entry.productId === item.productId,
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
    const pickingItems = db.pickingItems.filter((item) => item.pickingOrderId === pickingOrderId);
    if (pickingItems.length === 0) {
      throw new Error(`PickingOrder has no lines: ${pickingOrderId}`);
    }
    pickingItems.forEach((item) => {
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
        (total, allocation) => total + getInventoryReservationAllocationRemaining(allocation),
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
        pickingOrderId: result.item.pickingOrderId,
        pickingLineId: result.item.id,
        orderId: result.orderId,
        action: "updated",
      });
    }
  }

  private emitSafely<EventName extends DataEventName>(
    event: EventName,
    ...args: DataEventArguments<EventName>
  ): void {
    try {
      this.emit(event, ...args);
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

function planPersistedReservationConsumption(reservation: InventoryReservation, quantity: number) {
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

function getNewRequestedSerialNumbers(
  requested: string[] | undefined,
  delta: number,
): string[] | undefined {
  if (requested === undefined) return undefined;
  const normalized = requested.map((serial) => serial.trim()).filter(Boolean);
  if (
    normalized.length === 0 ||
    new Set(normalized).size !== normalized.length ||
    normalized.length !== delta
  ) {
    throw new Error("Picking serial numbers must identify exactly the new picked quantity");
  }
  return normalized;
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
