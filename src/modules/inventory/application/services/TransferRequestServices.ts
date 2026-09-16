import type { InventoryTransferRequest } from "@/core/entities";
import { InventoryTransferRequestStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { TransferRequestDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";
import { MAX_SAFE_INVENTORY_QUANTITY, TEXT_LIMITS } from "@/shared/utils/inputLimits";
import { isQuantityCompatibleWithUnit } from "@/shared/utils/numberInput";
import {
  ensureCanManageTransfers,
  ensureInventoryBranchBelongsToTenant,
  ensureProductBelongsToTenant,
  ensureTenantCanUseInventory,
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

  async execute(requestId: string): Promise<InventoryTransferRequest> {
    const { tenantId, actorUserId, user, permissions } = await resolveInventoryContext(
      this.repositories,
    );
    ensureCanManageTransfers(permissions);
    await ensureTenantCanUseInventory(this.repositories, tenantId);

    const request = await ensureReviewableRequest(this.repositories, requestId, tenantId);
    await ensureUserCanOperateInventoryBranch(this.repositories, user, request.sourceBranchId);
    await ensureInventoryBranchBelongsToTenant(
      this.repositories,
      tenantId,
      request.requestingBranchId,
    );

    return this.repositories.inventoryTransferRequests.approveRequest(request.id, {
      reviewedByUserId: actorUserId,
    });
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
