import type { PickingIncidentType, PickingItemStatus } from "@/core/enums";
import type { UpdatePickingItemInput } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  PickingActionResultDto,
  PickingDetailDto,
  PickingDetailLineDto,
  PickingIncidentDto,
  PickingProgressDto,
  PickingQueueItemDto,
  PickingReleaseDto,
} from "@/modules/logistics/application/dto/PickingReadModelDto";
import { resolveTrustedPickingContext } from "@/modules/logistics/application/services/PickingAuthorizationContext";

const PICKING_READ = "logistics.picking.read";
const PICKING_START = "logistics.picking.start";
const PICKING_COMPLETE = "logistics.picking.complete";

type PickingRepositories = Pick<
  RepositoryRegistry,
  "auth" | "users" | "roles" | "branches" | "picking" | "orders" | "products" | "inventory"
>;

export type PickingLineUpdateCommand = {
  pickingOrderId: string;
  pickingLineId: string;
  locationId?: string;
  lotId?: string;
  serialNumbers?: string[];
  status?: PickingItemStatus;
} & (
  | { pickedQuantity: number; operationId: string }
  | { pickedQuantity?: undefined; operationId?: never }
);

export interface RegisterPickingIncidentCommand {
  pickingOrderId: string;
  pickingLineId?: string;
  type: PickingIncidentType;
  quantityAffected?: number;
  comment: string;
}

export class PickingApplicationService {
  constructor(private readonly repositories: PickingRepositories) {}

  async getQueue(selectedBranchId: string): Promise<PickingQueueItemDto[]> {
    const context = await this.context(selectedBranchId, PICKING_READ);
    const scope = { tenantId: context.tenantId, branchId: context.branchId };
    const pickingOrders = await this.repositories.picking.getQueue(scope);
    return Promise.all(
      pickingOrders.map(async (pickingOrder) => {
        const [order, lines] = await Promise.all([
          this.repositories.orders.getById(pickingOrder.orderId),
          this.repositories.picking.getItems(scope, pickingOrder.id),
        ]);
        if (!order || order.tenantId !== context.tenantId || order.branchId !== context.branchId) {
          throw new Error(`Order context conflict for PickingOrder: ${pickingOrder.id}`);
        }
        return {
          pickingOrderId: pickingOrder.id,
          orderId: order.id,
          orderReference: order.orderNumber,
          branchId: pickingOrder.branchId,
          status: pickingOrder.status,
          assignedUserId: pickingOrder.assignedUserId ?? null,
          progress: getProgress(lines),
          startedAt: pickingOrder.startedAt ?? null,
          createdAt: pickingOrder.createdAt,
          updatedAt: pickingOrder.updatedAt,
        };
      }),
    );
  }

  async getDetail(selectedBranchId: string, pickingOrderId: string): Promise<PickingDetailDto> {
    const context = await this.context(selectedBranchId, PICKING_READ);
    return this.buildDetail(context, pickingOrderId);
  }

  async assign(selectedBranchId: string, pickingOrderId: string): Promise<PickingActionResultDto> {
    const context = await this.context(selectedBranchId, PICKING_START);
    const result = await this.repositories.picking.assign({
      ...context,
      pickingOrderId,
      actorUserId: context.actorUserId,
    });
    return toActionResult(result.pickingOrder, result.idempotent);
  }

  async release(
    selectedBranchId: string,
    pickingOrderId: string,
    reason: string,
  ): Promise<PickingReleaseDto> {
    const context = await this.context(selectedBranchId, PICKING_START);
    const result = await this.repositories.picking.release({
      ...context,
      pickingOrderId,
      actorUserId: context.actorUserId,
      reason,
    });
    return toReleaseDto(result.release);
  }

  async getReleaseHistory(
    selectedBranchId: string,
    pickingOrderId: string,
  ): Promise<PickingReleaseDto[]> {
    const context = await this.context(selectedBranchId, PICKING_READ);
    const releases = await this.repositories.picking.getReleaseHistory(context, pickingOrderId);
    return releases.map(toReleaseDto);
  }

  async registerIncident(
    selectedBranchId: string,
    command: RegisterPickingIncidentCommand,
  ): Promise<PickingIncidentDto> {
    const context = await this.context(selectedBranchId, PICKING_START);
    const incident = await this.repositories.picking.registerIncident({
      ...command,
      tenantId: context.tenantId,
      branchId: context.branchId,
      createdBy: context.actorUserId,
    });
    return toIncidentDto(incident);
  }

  async getIncidents(
    selectedBranchId: string,
    pickingOrderId: string,
  ): Promise<PickingIncidentDto[]> {
    const context = await this.context(selectedBranchId, PICKING_READ);
    const incidents = await this.repositories.picking.getIncidents(context, pickingOrderId);
    return incidents.map(toIncidentDto);
  }

  async resolveIncident(
    selectedBranchId: string,
    pickingOrderId: string,
    incidentId: string,
  ): Promise<PickingIncidentDto> {
    const context = await this.context(selectedBranchId, PICKING_START);
    const incident = await this.repositories.picking.resolveIncident({
      ...context,
      pickingOrderId,
      incidentId,
      resolvedBy: context.actorUserId,
    });
    return toIncidentDto(incident);
  }

  async getInventoryAvailability(
    selectedBranchId: string,
    pickingOrderId: string,
    productId: string,
  ) {
    const context = await this.context(selectedBranchId, PICKING_READ);
    const pickingOrder = await this.requirePickingOrder(context, pickingOrderId);
    return this.repositories.inventory.getPickingAvailability({
      ...context,
      pickingOrderId,
      orderId: pickingOrder.orderId,
      productId,
    });
  }

  async updateLine(selectedBranchId: string, command: PickingLineUpdateCommand) {
    const context = await this.context(selectedBranchId, PICKING_START);
    await this.requirePickingOrder(context, command.pickingOrderId);
    const input: UpdatePickingItemInput = {
      ...command,
      tenantId: context.tenantId,
      branchId: context.branchId,
      pickingItemId: command.pickingLineId,
      performedByUserId: context.actorUserId,
    };
    await this.repositories.picking.updateItem(input);
    return this.buildDetail(context, command.pickingOrderId);
  }

  async complete(selectedBranchId: string, pickingOrderId: string) {
    const context = await this.context(selectedBranchId, PICKING_COMPLETE);
    const result = await this.repositories.picking.complete({
      ...context,
      pickingOrderId,
      actorUserId: context.actorUserId,
    });
    return {
      ...toActionResult(result.pickingOrder, result.idempotent),
      orderStatus: result.order.status,
    };
  }

  private context(selectedBranchId: string, permission: string) {
    return resolveTrustedPickingContext(this.repositories, selectedBranchId, permission);
  }

  private async requirePickingOrder(
    context: { tenantId: string; branchId: string },
    pickingOrderId: string,
  ) {
    const pickingOrder = await this.repositories.picking.getById(context, pickingOrderId);
    if (!pickingOrder)
      throw new Error(`PickingOrder not found in authorized scope: ${pickingOrderId}`);
    return pickingOrder;
  }

  private async buildDetail(
    context: { tenantId: string; branchId: string },
    pickingOrderId: string,
  ): Promise<PickingDetailDto> {
    const scope = { tenantId: context.tenantId, branchId: context.branchId };
    const pickingOrder = await this.requirePickingOrder(scope, pickingOrderId);
    const [order, lines, locations, incidents, releases] = await Promise.all([
      this.repositories.orders.getById(pickingOrder.orderId),
      this.repositories.picking.getItems(scope, pickingOrderId),
      this.repositories.inventory.getLocations(scope.branchId),
      this.repositories.picking.getIncidents(scope, pickingOrderId),
      this.repositories.picking.getReleaseHistory(scope, pickingOrderId),
    ]);
    if (!order || order.tenantId !== scope.tenantId || order.branchId !== scope.branchId) {
      throw new Error(`Order context conflict for PickingOrder: ${pickingOrderId}`);
    }
    const detailLines = await Promise.all(
      lines.map(async (line): Promise<PickingDetailLineDto> => {
        const product = await this.repositories.products.getById(line.productId);
        if (!product || product.tenantId !== scope.tenantId) {
          throw new Error(`Product context conflict for PickingLine: ${line.id}`);
        }
        const inventory = await this.repositories.inventory.getPickingAvailability({
          ...scope,
          pickingOrderId,
          orderId: order.id,
          productId: line.productId,
        });
        const location = locations.find(
          (item) => item.id === line.locationId && item.tenantId === scope.tenantId,
        );
        const lot = inventory.locations
          .flatMap((item) => item.lots)
          .find((item) => item.lotId === line.lotId);
        return {
          pickingLineId: line.id,
          orderItemId: line.orderItemId,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          requiredQuantity: line.requestedQuantity,
          pickedQuantity: line.pickedQuantity,
          remainingQuantity: line.requestedQuantity - line.pickedQuantity,
          status: line.status,
          location: location ? { id: location.id, code: location.code, name: location.name } : null,
          lot: lot ? { id: lot.lotId, number: lot.lotNumber } : null,
          serialNumbers: [...(line.serialNumbers ?? [])],
          availableLocations: inventory.locations.map((item) => ({
            id: item.locationId ?? null,
            code: item.locationCode ?? null,
            name: item.locationName ?? null,
            ownReservedQuantity: item.ownReservedQuantity,
            usableQuantity: item.usableQuantity,
          })),
          availableLots: inventory.locations.flatMap((item) =>
            item.lots.map((candidate) => ({
              id: candidate.lotId,
              number: candidate.lotNumber,
              expirationDate: candidate.expirationDate ?? null,
              physicalQuantity: candidate.physicalQuantity,
            })),
          ),
          availableSerialNumbers: inventory.locations.flatMap((item) =>
            item.serialNumbers.map((serial) => serial.serialNumber),
          ),
          tracking: { ...product.tracking },
          inventory,
        };
      }),
    );
    return {
      pickingOrderId: pickingOrder.id,
      orderId: order.id,
      orderReference: order.orderNumber,
      branchId: pickingOrder.branchId,
      status: pickingOrder.status,
      assignedUserId: pickingOrder.assignedUserId ?? null,
      progress: getProgress(lines),
      startedAt: pickingOrder.startedAt ?? null,
      completedAt: pickingOrder.completedAt ?? null,
      createdAt: pickingOrder.createdAt,
      updatedAt: pickingOrder.updatedAt,
      lines: detailLines,
      incidents: incidents.map(toIncidentDto),
      releases: releases.map(toReleaseDto),
    };
  }
}

function getProgress(
  lines: Array<{ requestedQuantity: number; pickedQuantity: number }>,
): PickingProgressDto {
  const requiredQuantity = lines.reduce((total, line) => total + line.requestedQuantity, 0);
  const pickedQuantity = lines.reduce((total, line) => total + line.pickedQuantity, 0);
  return {
    requiredQuantity,
    pickedQuantity,
    remainingQuantity: Math.max(requiredQuantity - pickedQuantity, 0),
    percentage: requiredQuantity === 0 ? 0 : Math.round((pickedQuantity / requiredQuantity) * 100),
  };
}

function toActionResult(
  pickingOrder: {
    id: string;
    orderId: string;
    status: PickingActionResultDto["status"];
    assignedUserId?: string;
    updatedAt: string;
  },
  idempotent: boolean,
): PickingActionResultDto {
  return {
    pickingOrderId: pickingOrder.id,
    orderId: pickingOrder.orderId,
    status: pickingOrder.status,
    assignedUserId: pickingOrder.assignedUserId ?? null,
    updatedAt: pickingOrder.updatedAt,
    idempotent,
  };
}

function toIncidentDto(incident: {
  id: string;
  pickingOrderId: string;
  pickingLineId?: string;
  type: PickingIncidentType;
  quantityAffected?: number;
  comment: string;
  status: PickingIncidentDto["status"];
  createdBy: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}): PickingIncidentDto {
  return {
    ...incident,
    pickingLineId: incident.pickingLineId ?? null,
    quantityAffected: incident.quantityAffected ?? null,
    resolvedBy: incident.resolvedBy ?? null,
    resolvedAt: incident.resolvedAt ?? null,
  };
}

function toReleaseDto(release: {
  id: string;
  pickingOrderId: string;
  actorUserId: string;
  reason: string;
  releasedAt: string;
}): PickingReleaseDto {
  return { ...release };
}
