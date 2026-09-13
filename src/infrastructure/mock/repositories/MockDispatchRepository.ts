import type { Dispatch, Notification } from "@/core/entities";
import {
  DispatchStatus,
  InventoryReservationStatus,
  NotificationChannel,
  NotificationStatus,
  OrderStatus,
  PickingIncidentStatus,
  PickingStatus,
  ProductType,
  TransportMode,
  UserStatus,
  UserType,
} from "@/core/enums";
import { assertOrderStatusTransition } from "@/core/orders/orderStatusTransitions";
import type {
  ConfirmDispatchInput,
  ConfirmDispatchResult,
  DispatchNotificationStatus,
  DispatchReadScope,
  DispatchRepository,
  MarkDispatchDeliveredInput,
  MarkDispatchDeliveredResult,
} from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import { getInventoryReservationAllocationRemaining } from "@/infrastructure/mock/repositories/inventoryReservationMutations";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";

interface DispatchMutationResult extends ConfirmDispatchResult {
  dispatchChanged: boolean;
  orderChanged: boolean;
  notificationChanged: boolean;
}

export class MockDispatchRepository extends BaseMockRepository implements DispatchRepository {
  async getAll(scope: DispatchReadScope) {
    return this.read((db) =>
      db.dispatches.filter(
        (item) =>
          item.tenantId === scope.tenantId &&
          (scope.branchId === undefined || item.branchId === scope.branchId),
      ),
    );
  }

  async getById(scope: DispatchReadScope, id: string) {
    return this.read(
      (db) =>
        db.dispatches.find(
          (item) =>
            item.id === id &&
            item.tenantId === scope.tenantId &&
            (scope.branchId === undefined || item.branchId === scope.branchId),
        ) ?? null,
    );
  }

  async getByOrder(scope: DispatchReadScope, orderId: string) {
    return this.read(
      (db) =>
        db.dispatches.find(
          (item) =>
            item.orderId === orderId &&
            item.tenantId === scope.tenantId &&
            (scope.branchId === undefined || item.branchId === scope.branchId),
        ) ?? null,
    );
  }

  async confirm(input: ConfirmDispatchInput): Promise<ConfirmDispatchResult> {
    const operationId = input.operationId.trim();
    if (!operationId) throw new Error("Dispatch operationId is required");
    const carrierName = normalizeOptional(input.carrierName);
    const trackingNumber = normalizeOptional(input.trackingNumber);

    const result = this.store.transact<DispatchMutationResult>((db) => {
      this.assertActor(input, db);
      const order = db.orders.find(
        (item) =>
          item.id === input.orderId &&
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId,
      );
      if (!order)
        throw new Error(`Order not found for authorized dispatch scope: ${input.orderId}`);
      if (order.deliveryMethod !== "home_delivery") {
        throw new Error(`Order delivery method is not dispatchable: ${order.deliveryMethod}`);
      }
      if (![TransportMode.third_party, TransportMode.own_fleet].includes(order.transportMode)) {
        throw new Error(`Order transport mode is not dispatchable: ${order.transportMode}`);
      }
      if (order.transportMode === TransportMode.third_party) {
        if (!carrierName) throw new Error("Third-party dispatch carrierName is required");
        if (!trackingNumber) throw new Error("Third-party dispatch trackingNumber is required");
      }

      const fingerprint = getDispatchFingerprint({
        tenantId: input.tenantId,
        orderId: order.id,
        transportMode: order.transportMode,
        carrierName,
        trackingNumber,
      });
      const operationConflict = db.dispatches.find(
        (item) =>
          item.tenantId === input.tenantId &&
          item.confirmationOperationId === operationId &&
          item.orderId !== order.id,
      );
      if (operationConflict) throw new Error(`Dispatch operation conflict: ${operationId}`);

      const matches = db.dispatches.filter(
        (item) => item.tenantId === input.tenantId && item.orderId === order.id,
      );
      if (matches.length > 1) throw new Error(`Duplicate Dispatch records for Order: ${order.id}`);
      let dispatch = matches[0];
      if (dispatch && dispatch.branchId !== input.branchId) {
        throw new Error(`Dispatch branch conflict for Order: ${order.id}`);
      }

      if (dispatch?.confirmationOperationId === operationId) {
        if (dispatch.confirmationFingerprint !== fingerprint) {
          throw new Error(`Dispatch operation conflict: ${operationId}`);
        }
        return this.buildRetryResult(order, dispatch, db);
      }

      if (order.status === OrderStatus.dispatched) {
        if (!dispatch || dispatch.status !== DispatchStatus.dispatched) {
          throw new Error(`Dispatched Order has no canonical Dispatch: ${order.id}`);
        }
        if (!dispatchDataMatches(dispatch, order.transportMode, carrierName, trackingNumber)) {
          throw new Error(`Dispatch data conflict for already dispatched Order: ${order.id}`);
        }
        return this.buildRetryResult(order, dispatch, db);
      }
      if (order.status !== OrderStatus.ready_for_dispatch) {
        throw new Error(`Order is not ready for dispatch: ${order.id}`);
      }

      const picking = db.pickingOrders.find(
        (item) =>
          item.orderId === order.id &&
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId,
      );
      if (!picking || picking.status !== PickingStatus.completed) {
        throw new Error(`Picking is not completed for Order: ${order.id}`);
      }
      if (
        db.pickingIncidents.some(
          (incident) =>
            incident.pickingOrderId === picking.id &&
            incident.tenantId === input.tenantId &&
            incident.branchId === input.branchId &&
            incident.status === PickingIncidentStatus.open,
        )
      ) {
        throw new Error(`Picking has unresolved incidents for Order: ${order.id}`);
      }
      this.assertReservationsConsumed(picking.id, order.id, input, db);

      const now = this.now();
      const dispatchChanged = true;
      if (!dispatch) {
        dispatch = {
          id: this.id("dispatch"),
          tenantId: input.tenantId,
          branchId: input.branchId,
          orderId: order.id,
          status: DispatchStatus.dispatched,
          transportMode: order.transportMode,
          carrierName,
          trackingNumber,
          dispatchedByUserId: input.actorUserId,
          confirmationOperationId: operationId,
          confirmationFingerprint: fingerprint,
          dispatchedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        db.dispatches.push(dispatch);
      } else {
        if (dispatch.status === DispatchStatus.dispatched) {
          throw new Error(`Dispatch state conflict for Order: ${order.id}`);
        }
        Object.assign(dispatch, {
          status: DispatchStatus.dispatched,
          transportMode: order.transportMode,
          carrierName,
          trackingNumber,
          dispatchedByUserId: input.actorUserId,
          confirmationOperationId: operationId,
          confirmationFingerprint: fingerprint,
          dispatchedAt: now,
          updatedAt: now,
        });
      }

      assertOrderStatusTransition(order.status, OrderStatus.dispatched, "dispatch");
      order.status = OrderStatus.dispatched;
      order.updatedAt = now;
      const notification = this.createNotificationIfApplicable(order, dispatch, db, now);
      const notificationStatus = getNotificationStatus(order.notificationContact);
      return {
        dispatch,
        order,
        notification,
        notificationStatus,
        idempotent: false,
        dispatchChanged,
        orderChanged: true,
        notificationChanged: notification !== undefined,
      };
    });

    if (result.dispatchChanged) {
      this.emitSafely("dispatch.changed", {
        entityId: result.dispatch.id,
        tenantId: result.dispatch.tenantId,
        branchId: result.dispatch.branchId,
        orderId: result.order.id,
        action: "status_changed",
      });
    }
    if (result.orderChanged) {
      this.emitSafely("order.changed", {
        entityId: result.order.id,
        tenantId: result.order.tenantId,
        branchId: result.order.branchId,
        orderId: result.order.id,
        action: "status_changed",
      });
    }
    if (result.notificationChanged && result.notification) {
      this.emitSafely("notification.changed", {
        entityId: result.notification.id,
        tenantId: result.notification.tenantId,
        branchId: result.dispatch.branchId,
        orderId: result.order.id,
        action: "created",
      });
    }
    return {
      dispatch: result.dispatch,
      order: result.order,
      notification: result.notification,
      notificationStatus: result.notificationStatus,
      idempotent: result.idempotent,
    };
  }

  async markDelivered(input: MarkDispatchDeliveredInput): Promise<MarkDispatchDeliveredResult> {
    const runtimeInput = input as MarkDispatchDeliveredInput & Record<string, unknown>;
    if (
      Object.prototype.hasOwnProperty.call(runtimeInput, "carrierName") ||
      Object.prototype.hasOwnProperty.call(runtimeInput, "trackingNumber") ||
      Object.prototype.hasOwnProperty.call(runtimeInput, "transportMode")
    ) {
      throw new Error("Delivery confirmation cannot modify dispatch shipment data");
    }

    const result = this.store.transact<
      MarkDispatchDeliveredResult & { dispatchChanged: boolean; orderChanged: boolean }
    >((db) => {
      this.assertActor(input, db);
      const order = db.orders.find(
        (item) =>
          item.id === input.orderId &&
          item.tenantId === input.tenantId &&
          item.branchId === input.branchId,
      );
      if (!order) {
        throw new Error(`Order not found for authorized delivery scope: ${input.orderId}`);
      }
      if (order.deliveryMethod !== "home_delivery") {
        throw new Error(
          `Order delivery method cannot be marked delivered: ${order.deliveryMethod}`,
        );
      }

      const matches = db.dispatches.filter(
        (item) => item.tenantId === input.tenantId && item.orderId === order.id,
      );
      if (matches.length !== 1) {
        throw new Error(`Canonical Dispatch not found for delivery: ${order.id}`);
      }
      const dispatch = matches[0];
      if (dispatch.branchId !== input.branchId) {
        throw new Error(`Dispatch branch conflict for delivery: ${order.id}`);
      }

      if (order.status === OrderStatus.delivered || dispatch.status === DispatchStatus.delivered) {
        if (
          order.status === OrderStatus.delivered &&
          dispatch.status === DispatchStatus.delivered &&
          dispatch.deliveredAt
        ) {
          return {
            order,
            dispatch,
            idempotent: true,
            dispatchChanged: false,
            orderChanged: false,
          };
        }
        throw new Error(`Delivery state conflict for Order: ${order.id}`);
      }
      if (order.status !== OrderStatus.dispatched) {
        throw new Error(`Order is not dispatched for delivery: ${order.id}`);
      }
      if (dispatch.status !== DispatchStatus.dispatched) {
        throw new Error(`Dispatch is not dispatched for delivery: ${dispatch.id}`);
      }

      assertOrderStatusTransition(order.status, OrderStatus.delivered, "dispatch");
      const now = this.now();
      order.status = OrderStatus.delivered;
      order.updatedAt = now;
      dispatch.status = DispatchStatus.delivered;
      dispatch.deliveredAt = now;
      dispatch.updatedAt = now;
      return {
        order,
        dispatch,
        idempotent: false,
        dispatchChanged: true,
        orderChanged: true,
      };
    });

    if (result.dispatchChanged) {
      this.emitSafely("dispatch.changed", {
        entityId: result.dispatch.id,
        tenantId: result.dispatch.tenantId,
        branchId: result.dispatch.branchId,
        orderId: result.order.id,
        action: "status_changed",
      });
    }
    if (result.orderChanged) {
      this.emitSafely("order.changed", {
        entityId: result.order.id,
        tenantId: result.order.tenantId,
        branchId: result.order.branchId,
        orderId: result.order.id,
        action: "status_changed",
      });
    }
    return {
      order: result.order,
      dispatch: result.dispatch,
      idempotent: result.idempotent,
    };
  }

  private assertActor(input: { tenantId: string; actorUserId: string }, db: MockDatabase): void {
    const actor = db.users.find(
      (user) =>
        user.id === input.actorUserId &&
        user.tenantId === input.tenantId &&
        user.status === UserStatus.active &&
        user.type === UserType.employee,
    );
    if (!actor) throw new Error(`Dispatch actor not found for tenant: ${input.actorUserId}`);
  }

  private assertReservationsConsumed(
    pickingOrderId: string,
    orderId: string,
    input: ConfirmDispatchInput,
    db: MockDatabase,
  ): void {
    db.inventoryReservations
      .filter(
        (reservation) =>
          reservation.tenantId === input.tenantId &&
          reservation.branchId === input.branchId &&
          reservation.orderId === orderId,
      )
      .forEach((reservation) => {
        const remaining = reservation.allocations.reduce(
          (total, allocation) => total + getInventoryReservationAllocationRemaining(allocation),
          0,
        );
        if (reservation.status !== InventoryReservationStatus.consumed || remaining !== 0) {
          throw new Error(`Inventory reservation is not consumed for dispatch: ${reservation.id}`);
        }
      });
    const items = db.pickingItems.filter((item) => item.pickingOrderId === pickingOrderId);
    items.forEach((item) => {
      const product = db.products.find(
        (entry) => entry.id === item.productId && entry.tenantId === input.tenantId,
      );
      if (!product) throw new Error(`Product not found for dispatch validation: ${item.productId}`);
      if (product.productType !== ProductType.physical || !product.tracking.stock) return;
      const reservation = db.inventoryReservations.find(
        (entry) =>
          entry.tenantId === input.tenantId &&
          entry.branchId === input.branchId &&
          entry.orderId === orderId &&
          entry.orderItemId === item.orderItemId &&
          entry.productId === item.productId,
      );
      const remaining = reservation?.allocations.reduce(
        (total, allocation) => total + getInventoryReservationAllocationRemaining(allocation),
        0,
      );
      if (
        !reservation ||
        reservation.status !== InventoryReservationStatus.consumed ||
        remaining !== 0
      ) {
        throw new Error(`Inventory reservation is not consumed for dispatch: ${item.id}`);
      }
    });
  }

  private createNotificationIfApplicable(
    order: ConfirmDispatchResult["order"],
    dispatch: Dispatch,
    db: MockDatabase,
    now: string,
  ): Notification | undefined {
    if (order.notificationContact?.emailMode !== "send") return undefined;
    const deduplicationKey = `dispatch-email:${order.tenantId}:${order.id}`;
    const existing = db.notifications.find(
      (item) => item.tenantId === order.tenantId && item.deduplicationKey === deduplicationKey,
    );
    if (existing) throw new Error(`Dispatch notification state conflict for Order: ${order.id}`);
    const carrierText = dispatch.carrierName ? ` Transportista: ${dispatch.carrierName}.` : "";
    const trackingText = dispatch.trackingNumber ? ` Guía: ${dispatch.trackingNumber}.` : "";
    const notification: Notification = {
      id: this.id("notification"),
      tenantId: order.tenantId,
      channel: NotificationChannel.email,
      type: "dispatch_simulated_email",
      title: `Pedido ${order.orderNumber} enviado`,
      message: `Estado: Enviado.${carrierText}${trackingText}`,
      status: NotificationStatus.unread,
      relatedEntityType: "Order",
      relatedEntityId: order.id,
      deliveryStatus: "simulated_sent",
      recipientEmail: order.notificationContact.email,
      orderId: order.id,
      dispatchId: dispatch.id,
      orderReference: order.orderNumber,
      carrierName: dispatch.carrierName,
      trackingNumber: dispatch.trackingNumber,
      deduplicationKey,
      sentAt: now,
      simulatedDeliveryResult: "accepted",
      createdAt: now,
    };
    db.notifications.push(notification);
    return notification;
  }

  private buildRetryResult(
    order: ConfirmDispatchResult["order"],
    dispatch: Dispatch,
    db: MockDatabase,
  ): DispatchMutationResult {
    if (order.status !== OrderStatus.dispatched || dispatch.status !== DispatchStatus.dispatched) {
      throw new Error(`Dispatch retry state conflict for Order: ${order.id}`);
    }
    const notification = db.notifications.find(
      (item) => item.tenantId === order.tenantId && item.dispatchId === dispatch.id,
    );
    if (order.notificationContact?.emailMode === "send" && !notification) {
      throw new Error(`Dispatch simulated notification is missing for Order: ${order.id}`);
    }
    return {
      dispatch,
      order,
      notification,
      notificationStatus: getNotificationStatus(order.notificationContact),
      idempotent: true,
      dispatchChanged: false,
      orderChanged: false,
      notificationChanged: false,
    };
  }

  private emitSafely(event: DataEventName, payload: DataEventPayload): void {
    try {
      this.emit(event, payload);
    } catch {
      // The authoritative transaction is committed before observers are notified.
    }
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function getDispatchFingerprint(input: {
  tenantId: string;
  orderId: string;
  transportMode: TransportMode;
  carrierName?: string;
  trackingNumber?: string;
}): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    orderId: input.orderId,
    transportMode: input.transportMode,
    carrierName: input.carrierName ?? null,
    trackingNumber: input.trackingNumber ?? null,
  });
}

function dispatchDataMatches(
  dispatch: Dispatch,
  transportMode: TransportMode,
  carrierName?: string,
  trackingNumber?: string,
): boolean {
  return (
    dispatch.transportMode === transportMode &&
    normalizeOptional(dispatch.carrierName) === carrierName &&
    normalizeOptional(dispatch.trackingNumber) === trackingNumber
  );
}

function getNotificationStatus(
  contact: ConfirmDispatchResult["order"]["notificationContact"],
): DispatchNotificationStatus {
  if (contact?.emailMode === "send") return "simulated_sent";
  if (contact?.emailMode === "not_applicable") return "not_applicable";
  return "legacy_unknown_skipped";
}
