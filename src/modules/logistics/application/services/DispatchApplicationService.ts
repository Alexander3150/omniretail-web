import type { Notification, Order, Package, PickingOrder } from "@/core/entities";
import { DeliveryMethod, OrderStatus, PackingStatus, PickingStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  ConfirmDispatchCommand,
  ConfirmDispatchResultDto,
  DispatchAddressDto,
  DispatchDetailDto,
  DispatchNotificationContactDto,
  DispatchNotificationDto,
  MarkDispatchDeliveredCommand,
  MarkDispatchDeliveredResultDto,
  PreparedOrderDetailDto,
  PreparedOrderQueueItemDto,
} from "@/modules/logistics/application/dto/DispatchReadModelDto";
import { resolveTrustedDispatchContext } from "@/modules/logistics/application/services/DispatchAuthorizationContext";

const DISPATCH_READ = "logistics.dispatch.read";
const DISPATCH_CONFIRM = "logistics.dispatch.confirm";

type DispatchRepositories = Pick<
  RepositoryRegistry,
  "auth" | "users" | "roles" | "branches" | "orders" | "picking" | "packings" | "dispatches" | "notifications"
>;

export class DispatchApplicationService {
  constructor(private readonly repositories: DispatchRepositories) {}

  async getPreparedQueue(selectedBranchId: string): Promise<PreparedOrderQueueItemDto[]> {
    const context = await this.context(selectedBranchId, DISPATCH_READ);
    const orders = (
      await this.repositories.orders.listByBranch(context.tenantId, context.branchId)
    ).filter(
      (order) =>
        order.tenantId === context.tenantId &&
        order.branchId === context.branchId &&
        order.status === OrderStatus.ready_for_dispatch &&
        order.deliveryMethod === DeliveryMethod.home_delivery,
    );
    return Promise.all(orders.map((order) => this.toPreparedItem(context, order)));
  }

  async getPreparedDetail(
    selectedBranchId: string,
    orderId: string,
  ): Promise<PreparedOrderDetailDto> {
    const context = await this.context(selectedBranchId, DISPATCH_READ);
    const order = await this.requirePreparedOrder(context, orderId);
    return {
      ...(await this.toPreparedItem(context, order)),
      orderStatus: order.status,
      pickingStatus: "completed",
    };
  }

  async getDispatchDetail(selectedBranchId: string, orderId: string): Promise<DispatchDetailDto> {
    const context = await this.context(selectedBranchId, DISPATCH_READ);
    const order = await this.requireScopedOrder(context, orderId);
    if (
      ![OrderStatus.ready_for_dispatch, OrderStatus.dispatched, OrderStatus.delivered].includes(
        order.status,
      )
    ) {
      throw new Error(`Order is not available in dispatch detail: ${order.id}`);
    }
    const picking = await this.requireCompletedPicking(context, order.id);
    await this.requireFinalizedPacking(context, order.id);
    const dispatch = await this.repositories.dispatches.getByOrder(context, order.id);
    const packages = dispatch
      ? await this.repositories.dispatches.getPackagesByDispatch(context, dispatch.id)
      : [];
    const notification = dispatch
      ? await this.repositories.notifications.getByDispatch(context.tenantId, dispatch.id)
      : null;
    return {
      ...toPreparedItem(order, picking),
      orderStatus: order.status,
      pickingStatus: "completed",
      dispatch: dispatch
        ? {
            id: dispatch.id,
            status: dispatch.status,
            carrierName: dispatch.carrierName ?? null,
            trackingNumber: dispatch.trackingNumber ?? null,
            dispatchedAt: dispatch.dispatchedAt ?? null,
            deliveredAt: dispatch.deliveredAt ?? null,
            dispatchedByUserId: dispatch.dispatchedByUserId ?? null,
          }
        : null,
      notification: toNotificationDto(notification),
      packages: packages.map(toPackageDto),
    };
  }

  async confirm(
    selectedBranchId: string,
    command: ConfirmDispatchCommand,
  ): Promise<ConfirmDispatchResultDto> {
    const context = await this.context(selectedBranchId, DISPATCH_CONFIRM);
    const result = await this.repositories.dispatches.confirm({
      tenantId: context.tenantId,
      branchId: context.branchId,
      actorUserId: context.actorUserId,
      orderId: command.orderId,
      operationId: command.operationId,
      carrierName: command.carrierName,
      trackingNumber: command.trackingNumber,
    });
    if (!result.dispatch.dispatchedAt) throw new Error("Confirmed Dispatch has no dispatchedAt");
    return {
      orderId: result.order.id,
      orderStatus: result.order.status,
      dispatchId: result.dispatch.id,
      dispatchStatus: result.dispatch.status,
      transportMode: result.dispatch.transportMode,
      carrierName: result.dispatch.carrierName ?? null,
      trackingNumber: result.dispatch.trackingNumber ?? null,
      dispatchedAt: result.dispatch.dispatchedAt,
      notificationStatus: result.notificationStatus,
      notification: toNotificationDto(result.notification ?? null),
      packages: result.packages.map(toPackageDto),
      idempotent: result.idempotent,
    };
  }

  async markDelivered(
    selectedBranchId: string,
    command: MarkDispatchDeliveredCommand,
  ): Promise<MarkDispatchDeliveredResultDto> {
    const runtimeCommand = command as MarkDispatchDeliveredCommand & Record<string, unknown>;
    if (
      Object.prototype.hasOwnProperty.call(runtimeCommand, "carrierName") ||
      Object.prototype.hasOwnProperty.call(runtimeCommand, "trackingNumber") ||
      Object.prototype.hasOwnProperty.call(runtimeCommand, "transportMode")
    ) {
      throw new Error("Delivery confirmation cannot modify dispatch shipment data");
    }
    const context = await this.context(selectedBranchId, DISPATCH_CONFIRM);
    const result = await this.repositories.dispatches.markDelivered({
      tenantId: context.tenantId,
      branchId: context.branchId,
      actorUserId: context.actorUserId,
      orderId: command.orderId,
    });
    if (!result.dispatch.deliveredAt) {
      throw new Error("Delivered Dispatch has no deliveredAt");
    }
    return {
      orderId: result.order.id,
      orderStatus: result.order.status,
      dispatchId: result.dispatch.id,
      dispatchStatus: result.dispatch.status,
      deliveredAt: result.dispatch.deliveredAt,
      idempotent: result.idempotent,
    };
  }

  private async context(selectedBranchId: string, permission: string) {
    // Dispatch only completes an existing, scoped Order. A cancelled add-on must not strand
    // an already committed delivery; session, role, branch, resource and state still apply.
    return resolveTrustedDispatchContext(this.repositories, selectedBranchId, permission);
  }

  private async requireScopedOrder(
    context: { tenantId: string; branchId: string },
    orderId: string,
  ): Promise<Order> {
    const order = await this.repositories.orders.getById(orderId);
    if (!order || order.tenantId !== context.tenantId || order.branchId !== context.branchId) {
      throw new Error(`Order not found in authorized dispatch scope: ${orderId}`);
    }
    return order;
  }

  private async requirePreparedOrder(
    context: { tenantId: string; branchId: string },
    orderId: string,
  ): Promise<Order> {
    const order = await this.requireScopedOrder(context, orderId);
    if (
      order.status !== OrderStatus.ready_for_dispatch ||
      order.deliveryMethod !== DeliveryMethod.home_delivery
    ) {
      throw new Error(`Order is not prepared for dispatch: ${order.id}`);
    }
    return order;
  }

  private async requireCompletedPicking(
    context: { tenantId: string; branchId: string },
    orderId: string,
  ): Promise<PickingOrder> {
    const picking = await this.repositories.picking.getByOrder(context, orderId);
    if (!picking || picking.status !== PickingStatus.completed || !picking.completedAt) {
      throw new Error(`Picking is not completed for Order: ${orderId}`);
    }
    return picking;
  }

  private async toPreparedItem(
    context: { tenantId: string; branchId: string },
    order: Order,
  ): Promise<PreparedOrderQueueItemDto> {
    await this.requireFinalizedPacking(context, order.id);
    const picking = await this.requireCompletedPicking(context, order.id);
    return toPreparedItem(order, picking);
  }

  private async requireFinalizedPacking(
    context: { tenantId: string; branchId: string },
    orderId: string,
  ) {
    const packing = await this.repositories.packings.getByOrder(context, orderId);
    if (!packing || packing.status !== PackingStatus.finalized || !packing.finalizedAt) {
      throw new Error(`Packing is not finalized for Order: ${orderId}`);
    }
    return packing;
  }
}

function toPreparedItem(order: Order, picking: PickingOrder): PreparedOrderQueueItemDto {
  if (!picking.completedAt)
    throw new Error(`Picking completion timestamp is missing: ${picking.id}`);
  return {
    orderId: order.id,
    orderReference: order.orderNumber,
    createdAt: order.createdAt,
    recipientName: order.deliveryAddress?.recipientName ?? order.guestCustomer?.name ?? "",
    recipientPhone: order.deliveryAddress?.recipientPhone ?? null,
    address: toAddressDto(order),
    transportMode: order.transportMode,
    notificationContact: toNotificationContactDto(order),
    pickingOrderId: picking.id,
    pickingCompletedAt: picking.completedAt,
  };
}

function toAddressDto(order: Order): DispatchAddressDto | null {
  const address = order.deliveryAddress;
  if (!address) return null;
  return {
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone ?? null,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    stateOrDepartment: address.stateOrDepartment ?? null,
    postalCode: address.postalCode ?? null,
    country: address.country,
    references: address.references ?? null,
  };
}

function toNotificationContactDto(order: Order): DispatchNotificationContactDto {
  return order.notificationContact ?? { emailMode: "legacy_unknown" };
}

function toNotificationDto(notification: Notification | null): DispatchNotificationDto | null {
  if (
    !notification ||
    notification.deliveryStatus !== "simulated_sent" ||
    !notification.recipientEmail ||
    !notification.sentAt
  ) {
    return null;
  }
  return {
    id: notification.id,
    recipientEmail: notification.recipientEmail,
    deliveryStatus: notification.deliveryStatus,
    sentAt: notification.sentAt,
  };
}

function toPackageDto(item: Package) {
  return {
    id: item.id,
    number: item.number,
    weight: item.weight ?? null,
    description: item.description ?? null,
  };
}
