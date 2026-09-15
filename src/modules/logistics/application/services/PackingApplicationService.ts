import type { Order, Packing } from "@/core/entities";
import { DeliveryMethod, OrderStatus, PackingStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  ConfirmStorePickupDeliveryCommand,
  ConfirmStorePickupDeliveryResultDto,
  FinalizePackingCommand,
  FinalizePackingResultDto,
  GeneratePackingLabelCommand,
  PackingActionResultDto,
  PackingDetailDto,
  PackingQueueItemDto,
  RegisterPackingLabelPrintCommand,
  SavePackingPreparationCommand,
} from "@/modules/logistics/application/dto/PackingReadModelDto";
import { resolveTrustedPackingContext } from "@/modules/logistics/application/services/PackingAuthorizationContext";

const PACKING_READ = "logistics.packing.read";
const PACKING_PREPARE = "logistics.packing.prepare";
const PACKING_FINALIZE = "logistics.packing.finalize";

type PackingRepositories = Pick<
  RepositoryRegistry,
  | "auth"
  | "users"
  | "roles"
  | "branches"
  | "customers"
  | "orders"
  | "packings"
  | "storePickupDeliveries"
>;

export class PackingApplicationService {
  constructor(private readonly repositories: PackingRepositories) {}

  async getQueue(selectedBranchId: string): Promise<PackingQueueItemDto[]> {
    const context = await this.context(selectedBranchId, PACKING_READ);
    const [activePackings, branchOrders] = await Promise.all([
      this.repositories.packings.getQueue(context),
      this.repositories.orders.listByBranch(context.tenantId, context.branchId),
    ]);
    const readyPickupPackings = await Promise.all(
      branchOrders
        .filter((order) =>
          order.deliveryMethod === DeliveryMethod.store_pickup &&
          order.status === OrderStatus.ready_for_pickup,
        )
        .map((order) => this.repositories.packings.getByOrder(context, order.id)),
    );
    const packings = [...new Map(
      [...activePackings, ...readyPickupPackings.filter((item): item is Packing => item !== null)]
        .map((packing) => [packing.id, packing]),
    ).values()];
    const orders = await this.repositories.orders.getByIdsScoped(
      context.tenantId,
      context.branchId,
      packings.map((item) => item.orderId),
    );
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    return Promise.all(
      packings.map(async (packing) => {
        const order = ordersById.get(packing.orderId);
        if (!order) throw new Error(`Order not found for authorized Packing: ${packing.id}`);
        return this.toQueueItem(packing, order);
      }),
    );
  }

  async getDetail(selectedBranchId: string, packingId: string): Promise<PackingDetailDto> {
    const context = await this.context(selectedBranchId, PACKING_READ);
    const { packing, order } = await this.requireDetail(context, packingId);
    return this.toDetail(packing, order);
  }

  async savePreparation(
    selectedBranchId: string,
    command: SavePackingPreparationCommand,
  ): Promise<PackingActionResultDto> {
    const context = await this.context(selectedBranchId, PACKING_PREPARE);
    const result = await this.repositories.packings.savePreparation({ ...command, ...context });
    return this.toActionResult(context, result.packing, result.idempotent);
  }

  async generateLabel(
    selectedBranchId: string,
    command: GeneratePackingLabelCommand,
  ): Promise<PackingActionResultDto> {
    const context = await this.context(selectedBranchId, PACKING_PREPARE);
    const result = await this.repositories.packings.generateLabel({ ...command, ...context });
    return this.toActionResult(context, result.packing, result.idempotent);
  }

  async registerLabelPrint(
    selectedBranchId: string,
    command: RegisterPackingLabelPrintCommand,
  ): Promise<PackingActionResultDto> {
    const context = await this.context(selectedBranchId, PACKING_PREPARE);
    const result = await this.repositories.packings.registerLabelPrint({ ...command, ...context });
    return this.toActionResult(context, result.packing, result.idempotent);
  }

  async finalize(
    selectedBranchId: string,
    command: FinalizePackingCommand,
  ): Promise<FinalizePackingResultDto> {
    const context = await this.context(selectedBranchId, PACKING_FINALIZE);
    const result = await this.repositories.packings.finalize({ ...command, ...context });
    return {
      ...(await this.toActionResult(context, result.packing, result.idempotent)),
      orderStatus: result.order.status,
    };
  }

  async confirmStorePickupDelivery(
    selectedBranchId: string,
    command: ConfirmStorePickupDeliveryCommand,
  ): Promise<ConfirmStorePickupDeliveryResultDto> {
    const context = await this.context(selectedBranchId, PACKING_FINALIZE);
    const { packing, order } = await this.requireDetail(context, command.packingId);
    if (
      packing.status !== PackingStatus.finalized ||
      order.deliveryMethod !== DeliveryMethod.store_pickup ||
      (order.status !== OrderStatus.ready_for_pickup && order.status !== OrderStatus.delivered)
    ) {
      throw new Error(`Store pickup Order is not ready for delivery: ${order.id}`);
    }
    const result = await this.repositories.storePickupDeliveries.confirm({
      ...context,
      orderId: order.id,
      operationId: command.operationId,
    });
    return {
      packingId: packing.id,
      orderId: result.order.id,
      orderStatus: result.order.status,
      deliveredAt: result.delivery.deliveredAt,
      idempotent: result.idempotent,
    };
  }

  private context(selectedBranchId: string, permission: string) {
    return resolveTrustedPackingContext(this.repositories, selectedBranchId, permission);
  }

  private async requireDetail(
    context: { tenantId: string; branchId: string },
    packingId: string,
  ): Promise<{ packing: Packing; order: Order }> {
    const packing = await this.repositories.packings.getById(context, packingId);
    if (!packing) throw new Error(`Packing not found in authorized scope: ${packingId}`);
    const [order] = await this.repositories.orders.getByIdsScoped(
      context.tenantId,
      context.branchId,
      [packing.orderId],
    );
    if (!order) throw new Error(`Order not found for authorized Packing: ${packing.id}`);
    return { packing, order };
  }

  private async toActionResult(
    context: { tenantId: string; branchId: string },
    packing: Packing,
    idempotent: boolean,
  ): Promise<PackingActionResultDto> {
    const { order } = await this.requireDetail(context, packing.id);
    return { packing: await this.toDetail(packing, order), idempotent };
  }

  private async toQueueItem(packing: Packing, order: Order): Promise<PackingQueueItemDto> {
    if (
      order.deliveryMethod !== DeliveryMethod.home_delivery &&
      order.deliveryMethod !== DeliveryMethod.store_pickup
    ) {
      throw new Error(`Order delivery method cannot enter Packing: ${order.deliveryMethod}`);
    }
    if (
      (packing.status === PackingStatus.in_progress && order.status !== OrderStatus.packing) ||
      (packing.status === PackingStatus.finalized &&
        order.status !== OrderStatus.ready_for_dispatch &&
        order.status !== OrderStatus.ready_for_pickup &&
        order.status !== OrderStatus.dispatched &&
        order.status !== OrderStatus.delivered)
    ) {
      throw new Error(`Packing and Order state conflict: ${packing.id}`);
    }
    return {
      packingId: packing.id,
      orderId: order.id,
      orderReference: order.orderNumber,
      customerName: await this.resolveCustomerName(order),
      storePickupContact:
        order.deliveryMethod === DeliveryMethod.store_pickup && order.storePickupContact
          ? { ...order.storePickupContact }
          : null,
      deliveryMethod: order.deliveryMethod,
      status: packing.status,
      version: packing.version,
      startedAt: packing.startedAt,
      updatedAt: packing.updatedAt,
    };
  }

  private async toDetail(packing: Packing, order: Order): Promise<PackingDetailDto> {
    return {
      ...(await this.toQueueItem(packing, order)),
      pickingOrderId: packing.pickingOrderId,
      orderStatus: order.status,
      deliveryAddress: order.deliveryAddress ? { ...order.deliveryAddress } : null,
      checklist: { ...packing.checklist },
      totalWeight: packing.totalWeight ?? null,
      packageCount: packing.packageCount ?? null,
      labelGenerationId: packing.labelGenerationId ?? null,
      labelCode: packing.labelCode ?? null,
      labelGeneratedAt: packing.labelGeneratedAt ?? null,
      labelPrintedAt: packing.labelPrintedAt ?? null,
      finalizedAt: packing.finalizedAt ?? null,
    };
  }

  private async resolveCustomerName(order: Order): Promise<string> {
    if (order.deliveryMethod === DeliveryMethod.store_pickup && order.storePickupContact) {
      return order.storePickupContact.recipientName.trim();
    }
    if (order.guestCustomer?.name.trim()) return order.guestCustomer.name.trim();
    if (!order.customerId)
      return order.deliveryAddress?.recipientName.trim() || "Cliente no identificado";
    const customer = await this.repositories.customers.getById(order.customerId);
    return customer && customer.tenantId === order.tenantId
      ? customer.name
      : order.deliveryAddress?.recipientName.trim() || "Cliente no identificado";
  }
}
