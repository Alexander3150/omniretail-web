import type { Dispatch, Order, Packing, PickingOrder, StorePickupDelivery } from "@/core/entities";
import { DeliveryMethod, OrderStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  LogisticsHistoryDetailDto,
  LogisticsHistoryItemDto,
} from "@/modules/logistics/application/dto/LogisticsHistoryDto";
import { getLogisticsItemTraceForScope } from "@/modules/logistics/application/services/GetLogisticsItemTraceService";
import { resolveTrustedLogisticsHistoryContext } from "@/modules/logistics/application/services/LogisticsHistoryAuthorizationContext";

type HistoryRepositories = Pick<
  RepositoryRegistry,
  | "auth"
  | "users"
  | "roles"
  | "branches"
  | "customers"
  | "orders"
  | "picking"
  | "packings"
  | "dispatches"
  | "storePickupDeliveries"
  | "inventory"
  | "products"
>;

const HOME_HISTORY_STATUSES = new Set<OrderStatus>([
  OrderStatus.packing,
  OrderStatus.ready_for_dispatch,
  OrderStatus.dispatched,
  OrderStatus.delivered,
]);
const PICKUP_HISTORY_STATUSES = new Set<OrderStatus>([
  OrderStatus.packing,
  OrderStatus.ready_for_pickup,
  OrderStatus.delivered,
]);

export class GetLogisticsHistoryService {
  constructor(private readonly repositories: HistoryRepositories) {}

  async execute(selectedBranchId: string): Promise<LogisticsHistoryItemDto[]> {
    const context = await resolveTrustedLogisticsHistoryContext(this.repositories, selectedBranchId);
    const orders = (await this.repositories.orders.listByBranch(context.tenantId, context.branchId))
      .filter((order) => isHistoryOrder(order));
    const items = await Promise.all(orders.map((order) => this.toHistoryItem(context, order)));
    return items.sort((left, right) => getActivityAt(right).localeCompare(getActivityAt(left)));
  }

  async getDetail(
    selectedBranchId: string,
    orderId: string,
  ): Promise<LogisticsHistoryDetailDto> {
    const context = await resolveTrustedLogisticsHistoryContext(this.repositories, selectedBranchId);
    const order = (await this.repositories.orders.listByBranch(context.tenantId, context.branchId))
      .find((candidate) => candidate.id === orderId && isHistoryOrder(candidate));
    if (!order) throw new Error("Logistics history order not found.");
    const summary = await this.toHistoryItem(context, order);
    const items = summary.pickingOrderId
      ? await getLogisticsItemTraceForScope(this.repositories, context, {
          orderId: summary.orderId,
          pickingOrderId: summary.pickingOrderId,
        })
      : [];
    return { summary, items };
  }

  private async toHistoryItem(
    context: { tenantId: string; branchId: string },
    order: Order,
  ): Promise<LogisticsHistoryItemDto> {
    const scope = { tenantId: context.tenantId, branchId: context.branchId };
    const [picking, packing, dispatch, pickupDelivery] = await Promise.all([
      this.repositories.picking.getByOrder(scope, order.id),
      this.repositories.packings.getByOrder(scope, order.id),
      order.deliveryMethod === DeliveryMethod.home_delivery
        ? this.repositories.dispatches.getByOrder(scope, order.id)
        : Promise.resolve(null),
      order.deliveryMethod === DeliveryMethod.store_pickup
        ? this.repositories.storePickupDeliveries.getByOrder(scope, order.id)
        : Promise.resolve(null),
    ]);
    const candidateResponsibleUserId = getResponsibleUserId(
      picking,
      packing,
      dispatch,
      pickupDelivery,
    );
    const responsibleUser = candidateResponsibleUserId
      ? await this.repositories.users.getById(candidateResponsibleUserId)
      : null;
    const scopedResponsibleUser =
      responsibleUser?.tenantId === context.tenantId ? responsibleUser : null;
    const contact = await this.resolveContact(order, context.tenantId);
    const homeDelivery = order.deliveryMethod === DeliveryMethod.home_delivery;

    return {
      orderId: order.id,
      orderReference: order.orderNumber,
      deliveryMethod: order.deliveryMethod,
      operationalStatus: order.status,
      contactName: contact.name,
      contactPhone: contact.phone,
      pickingOrderId: picking?.id ?? null,
      packingId: packing?.id ?? null,
      dispatchId: dispatch?.id ?? null,
      storePickupDeliveryId: pickupDelivery?.id ?? null,
      pickingCompletedAt: picking?.completedAt ?? null,
      packingFinalizedAt: packing?.finalizedAt ?? null,
      dispatchedAt: dispatch?.dispatchedAt ?? null,
      deliveredAt: homeDelivery
        ? dispatch?.deliveredAt ?? null
        : pickupDelivery?.deliveredAt ?? null,
      responsibleUserId: scopedResponsibleUser?.id ?? null,
      responsibleUserName: scopedResponsibleUser?.name ?? null,
      totalWeight: homeDelivery ? packing?.totalWeight ?? null : null,
      packageCount: homeDelivery ? packing?.packageCount ?? null : null,
      dispatchStatus: dispatch?.status ?? null,
      carrierName: dispatch?.carrierName ?? null,
      trackingNumber: dispatch?.trackingNumber ?? null,
    };
  }

  private async resolveContact(order: Order, tenantId: string) {
    if (order.deliveryMethod === DeliveryMethod.store_pickup && order.storePickupContact) {
      return {
        name: order.storePickupContact.recipientName,
        phone: order.storePickupContact.recipientPhone,
      };
    }
    if (order.deliveryMethod === DeliveryMethod.home_delivery && order.deliveryAddress) {
      return {
        name: order.deliveryAddress.recipientName,
        phone: order.deliveryAddress.recipientPhone ?? null,
      };
    }
    if (order.guestCustomer?.name.trim()) {
      return { name: order.guestCustomer.name.trim(), phone: null };
    }
    if (order.customerId) {
      const customer = await this.repositories.customers.getById(order.customerId);
      if (customer?.tenantId === tenantId) {
        return { name: customer.name.trim() || "Cliente no identificado", phone: customer.phone ?? null };
      }
    }
    return { name: "Cliente no identificado", phone: null };
  }
}

function isHistoryOrder(order: Order): order is Order & {
  deliveryMethod: DeliveryMethod.home_delivery | DeliveryMethod.store_pickup;
} {
  if (order.deliveryMethod === DeliveryMethod.home_delivery) {
    return HOME_HISTORY_STATUSES.has(order.status);
  }
  if (order.deliveryMethod === DeliveryMethod.store_pickup) {
    return PICKUP_HISTORY_STATUSES.has(order.status);
  }
  return false;
}

function getResponsibleUserId(
  picking: PickingOrder | null,
  packing: Packing | null,
  dispatch: Dispatch | null,
  pickupDelivery: StorePickupDelivery | null,
) {
  return (
    pickupDelivery?.confirmedByUserId ??
    dispatch?.dispatchedByUserId ??
    packing?.finalizedByUserId ??
    packing?.startedByUserId ??
    picking?.assignedUserId ??
    null
  );
}

function getActivityAt(item: LogisticsHistoryItemDto) {
  return (
    item.deliveredAt ??
    item.dispatchedAt ??
    item.packingFinalizedAt ??
    item.pickingCompletedAt ??
    ""
  );
}
