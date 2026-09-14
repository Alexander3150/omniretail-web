import type { StorePickupDelivery } from "@/core/entities";
import { BranchStatus, DeliveryMethod, OrderStatus, UserStatus, UserType } from "@/core/enums";
import { assertOrderStatusTransition } from "@/core/orders/orderStatusTransitions";
import type {
  ConfirmStorePickupDeliveryInput,
  ConfirmStorePickupDeliveryResult,
  StorePickupDeliveryRepository,
  StorePickupDeliveryScope,
} from "@/core/repositories";
import type { DataEventArguments, DataEventName } from "@/core/types/events.types";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export interface MockStorePickupDeliveryRepositoryTestHooks {
  afterDeliveryCreated?: () => void;
}

export class MockStorePickupDeliveryRepository
  extends BaseMockRepository
  implements StorePickupDeliveryRepository
{
  constructor(
    ...args: [
      ...ConstructorParameters<typeof BaseMockRepository>,
      MockStorePickupDeliveryRepositoryTestHooks?,
    ]
  ) {
    super(args[0], args[1]);
    this.testHooks = args[2] ?? {};
  }

  private readonly testHooks: MockStorePickupDeliveryRepositoryTestHooks;

  async getByOrder(scope: StorePickupDeliveryScope, orderId: string) {
    return this.read(
      (db) =>
        db.storePickupDeliveries.find(
          (item) =>
            item.tenantId === scope.tenantId &&
            item.branchId === scope.branchId &&
            item.orderId === orderId,
        ) ?? null,
    );
  }

  async confirm(input: ConfirmStorePickupDeliveryInput): Promise<ConfirmStorePickupDeliveryResult> {
    const operationId = input.operationId.trim();
    if (!operationId) throw new Error("Store pickup operationId is required");

    const result = this.store.transact<ConfirmStorePickupDeliveryResult & { changed: boolean }>(
      (db) => {
        const branch = db.branches.find(
          (item) =>
            item.id === input.branchId &&
            item.tenantId === input.tenantId &&
            item.status === BranchStatus.active,
        );
        if (!branch) {
          throw new Error(`Branch not found for authorized store pickup scope: ${input.branchId}`);
        }
        const actor = db.users.find(
          (item) =>
            item.id === input.actorUserId &&
            item.tenantId === input.tenantId &&
            item.status === UserStatus.active &&
            item.type === UserType.employee,
        );
        if (!actor) throw new Error(`Store pickup actor not found: ${input.actorUserId}`);
        const order = db.orders.find(
          (item) =>
            item.id === input.orderId &&
            item.tenantId === input.tenantId &&
            item.branchId === input.branchId,
        );
        if (!order) {
          throw new Error(`Order not found for authorized store pickup scope: ${input.orderId}`);
        }
        if (order.deliveryMethod !== DeliveryMethod.store_pickup) {
          throw new Error(`Order is not a store pickup: ${order.id}`);
        }

        const fingerprint = getConfirmationFingerprint(input);
        const operationConflict = db.storePickupDeliveries.find(
          (item) =>
            item.tenantId === input.tenantId &&
            item.confirmationOperationId === operationId &&
            item.orderId !== order.id,
        );
        if (operationConflict) {
          throw new Error(`Store pickup operation conflict: ${operationId}`);
        }
        const matches = db.storePickupDeliveries.filter(
          (item) => item.tenantId === input.tenantId && item.orderId === order.id,
        );
        if (matches.length > 1) {
          throw new Error(`Duplicate StorePickupDelivery records for Order: ${order.id}`);
        }
        const existing = matches[0];
        if (existing && existing.branchId !== input.branchId) {
          throw new Error(`Store pickup delivery branch conflict for Order: ${order.id}`);
        }
        if (existing?.confirmationOperationId === operationId) {
          if (
            existing.confirmationFingerprint !== fingerprint ||
            order.status !== OrderStatus.delivered
          ) {
            throw new Error(`Store pickup retry state conflict: ${order.id}`);
          }
          return { order, delivery: existing, idempotent: true, changed: false };
        }
        if (existing || order.status === OrderStatus.delivered) {
          throw new Error(`Store pickup Order was already delivered: ${order.id}`);
        }
        if (order.status !== OrderStatus.ready_for_pickup) {
          throw new Error(`Order is not ready for store pickup delivery: ${order.id}`);
        }

        assertOrderStatusTransition(order.status, OrderStatus.delivered, "storePickup");
        const now = this.now();
        const delivery: StorePickupDelivery = {
          id: this.id("store-pickup-delivery"),
          tenantId: input.tenantId,
          branchId: input.branchId,
          orderId: order.id,
          confirmedByUserId: actor.id,
          confirmationOperationId: operationId,
          confirmationFingerprint: fingerprint,
          deliveredAt: now,
          createdAt: now,
        };
        db.storePickupDeliveries.push(delivery);
        this.testHooks.afterDeliveryCreated?.();
        order.status = OrderStatus.delivered;
        order.updatedAt = now;
        return { order, delivery, idempotent: false, changed: true };
      },
    );

    if (result.changed) {
      this.emitSafely("order.changed", {
        entityId: result.order.id,
        tenantId: result.order.tenantId,
        branchId: result.order.branchId,
        orderId: result.order.id,
        action: "status_changed",
        metadata: {
          entity: "StorePickupDelivery",
          storePickupDeliveryId: result.delivery.id,
        },
      });
    }
    return {
      order: result.order,
      delivery: result.delivery,
      idempotent: result.idempotent,
    };
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

function getConfirmationFingerprint(input: ConfirmStorePickupDeliveryInput): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    branchId: input.branchId,
    orderId: input.orderId,
    actorUserId: input.actorUserId,
  });
}
