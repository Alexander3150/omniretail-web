import type { InventoryTransferRequest } from "@/core/entities";
import { BranchStatus, InventoryTransferRequestStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { resolveCurrentSessionSnapshot } from "@/modules/auth/application/services/resolveCurrentSessionSnapshot";
import type { TransferRequestDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";
import { MAX_SAFE_INVENTORY_QUANTITY, TEXT_LIMITS } from "@/shared/utils/inputLimits";
import { isQuantityCompatibleWithUnit } from "@/shared/utils/numberInput";
import {
  ensureCanManageTransfers,
  ensureInventoryBranchBelongsToTenant,
  ensureProductBelongsToTenant,
  ensureTenantCanUseInventory,
  ensureTenantCanUseTracking,
  ensureUserCanOperateInventoryBranch,
  InventoryServiceError,
  resolveInventoryContext,
} from "@/modules/inventory/application/services/serviceHelpers";

export class CreateTransferRequestService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: TransferRequestDto): Promise<InventoryTransferRequest> {
    const { tenantId, actorUserId, user, permissions } = await resolveInventoryContext(
      this.repositories,
    );
    ensureCanManageTransfers(permissions);
    await ensureTenantCanUseInventory(this.repositories, tenantId);

    const product = ensureProductBelongsToTenant(
      await this.repositories.products.getById(dto.productId),
      tenantId,
    );
    await ensureUserCanOperateInventoryBranch(this.repositories, user, dto.requesterBranchId);
    await ensureInventoryBranchBelongsToTenant(this.repositories, tenantId, dto.providerBranchId);

    if (dto.requesterBranchId === dto.providerBranchId) {
      throw new InventoryServiceError("Las sucursales de origen y destino deben ser distintas.");
    }
    const baseUnit = await this.repositories.units.getByIdScoped(tenantId, product.baseUnitId);
    if (!baseUnit) {
      throw new InventoryServiceError("La unidad base del producto no esta disponible.");
    }
    assertValidTransferQuantity(dto.quantity, baseUnit.allowsDecimals);
    const reason = dto.reason.trim();
    if (!reason) throw new InventoryServiceError("Ingresa el motivo del traslado.");
    if (reason.length > TEXT_LIMITS.reason) {
      throw new InventoryServiceError("El motivo admite hasta 200 caracteres.");
    }
    if (dto.notes.length > TEXT_LIMITS.notes) {
      throw new InventoryServiceError("Las observaciones admiten hasta 500 caracteres.");
    }

    return this.repositories.inventoryTransferRequests.createRequest({
      tenantId,
      requestingBranchId: dto.requesterBranchId,
      sourceBranchId: dto.providerBranchId,
      productId: product.id,
      requestedQuantity: dto.quantity,
      reason: dto.reason,
      notes: dto.notes.trim() || undefined,
      requestedByUserId: actorUserId,
    });
  }
}

export function assertValidTransferQuantity(quantity: number, unitAllowsDecimals = true) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new InventoryServiceError("Ingresa una cantidad solicitada valida.");
  }
  if (quantity > MAX_SAFE_INVENTORY_QUANTITY) {
    throw new InventoryServiceError("La cantidad solicitada no puede superar 999,999.99.");
  }
  if (!isQuantityCompatibleWithUnit(quantity, unitAllowsDecimals)) {
    throw new InventoryServiceError(
      unitAllowsDecimals
        ? "La cantidad solicitada admite hasta 3 decimales."
        : "La unidad del producto no admite fracciones.",
    );
  }
}

export class ApproveTransferRequestService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(requestId: string, operationId = `transfer-request:${requestId}`) {
    const { tenantId, actorUserId, user, permissions } = await resolveInventoryContext(
      this.repositories,
    );
    ensureCanManageTransfers(permissions);
    const entitlements = await ensureTenantCanUseInventory(this.repositories, tenantId);

    const request = await this.repositories.inventoryTransferRequests.getById(requestId);
    if (!request || request.tenantId !== tenantId) {
      throw new InventoryServiceError("Solicitud de traslado no encontrada.");
    }
    const session = await resolveCurrentSessionSnapshot(this.repositories);
    const activeBranchId = session.sessionId
      ? (await this.repositories.auth.getSession(session.sessionId))?.activeBranchId
      : undefined;
    if (!activeBranchId || activeBranchId !== request.sourceBranchId) {
      throw new InventoryServiceError("La sucursal proveedora debe estar activa para aceptar la solicitud.");
    }
    const source = await ensureUserCanOperateInventoryBranch(
      this.repositories, user, request.sourceBranchId,
    );
    const destination = await ensureInventoryBranchBelongsToTenant(
      this.repositories,
      tenantId,
      request.requestingBranchId,
    );
    if (source.id === destination.id || source.status !== BranchStatus.active ||
      destination.status !== BranchStatus.active) {
      throw new InventoryServiceError("Las sucursales del traslado deben estar activas y ser distintas.");
    }
    const product = ensureProductBelongsToTenant(
      await this.repositories.products.getById(request.productId), tenantId,
    );
    const capabilities = await this.repositories.businessConfig.getCapabilities(tenantId);
    if (!capabilities) throw new InventoryServiceError("Configuración de inventario no disponible.");
    ensureTenantCanUseTracking(entitlements, capabilities, product);
    const unit = await this.repositories.units.getByIdScoped(tenantId, product.baseUnitId);
    if (!unit) throw new InventoryServiceError("La unidad base del producto no está disponible.");
    assertValidTransferQuantity(request.requestedQuantity, unit.allowsDecimals);
    if (!operationId.trim()) throw new InventoryServiceError("La operación requiere una identidad.");

    const result = await this.repositories.inventoryTransfers.create({
      tenantId,
      sourceBranchId: request.sourceBranchId,
      destinationBranchId: request.requestingBranchId,
      operationId: operationId.trim(),
      preparedByUserId: actorUserId,
      sourceRequestIds: [request.id],
      approveSourceRequest: { requestId: request.id, reviewedByUserId: actorUserId },
      reason: request.reason,
      notes: request.notes,
      items: [{ productId: product.id, sourceRequestId: request.id,
        requestedQuantity: request.requestedQuantity }],
    });
    return result.transfer;
  }
}

export class RejectTransferRequestService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(requestId: string, rejectionReason: string): Promise<InventoryTransferRequest> {
    const { tenantId, actorUserId, user, permissions } = await resolveInventoryContext(
      this.repositories,
    );
    ensureCanManageTransfers(permissions);
    await ensureTenantCanUseInventory(this.repositories, tenantId);

    const reason = rejectionReason.trim();
    if (!reason) throw new InventoryServiceError("Ingresa el motivo del rechazo.");
    if (reason.length > TEXT_LIMITS.reason) {
      throw new InventoryServiceError("El motivo admite hasta 200 caracteres.");
    }

    const request = await ensureReviewableRequest(this.repositories, requestId, tenantId);
    await ensureUserCanOperateInventoryBranch(this.repositories, user, request.sourceBranchId);
    await ensureInventoryBranchBelongsToTenant(
      this.repositories,
      tenantId,
      request.requestingBranchId,
    );

    return this.repositories.inventoryTransferRequests.rejectRequest(request.id, reason, {
      reviewedByUserId: actorUserId,
    });
  }
}

async function ensureReviewableRequest(
  repositories: RepositoryRegistry,
  requestId: string,
  tenantId: string,
): Promise<InventoryTransferRequest> {
  const request = await repositories.inventoryTransferRequests.getById(requestId);
  if (!request || request.tenantId !== tenantId) {
    throw new InventoryServiceError("Solicitud de traslado no encontrada.");
  }
  if (request.status !== InventoryTransferRequestStatus.requested) {
    throw new InventoryServiceError("La solicitud ya no está pendiente de revisión.");
  }
  const product = await repositories.products.getById(request.productId);
  ensureProductBelongsToTenant(product, tenantId);
  return request;
}
