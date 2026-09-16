import type { InventoryTransferRequest } from "@/core/entities";
import { InventoryTransferRequestStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { TransferRequestDto } from "@/modules/inventory/application/dto/InventoryAlertsDto";
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
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
      throw new InventoryServiceError("La cantidad solicitada debe ser mayor que cero.");
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
    await ensureInventoryBranchBelongsToTenant(this.repositories, tenantId, request.requestingBranchId);

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

    const request = await ensureReviewableRequest(this.repositories, requestId, tenantId);
    await ensureUserCanOperateInventoryBranch(this.repositories, user, request.sourceBranchId);
    await ensureInventoryBranchBelongsToTenant(this.repositories, tenantId, request.requestingBranchId);

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
