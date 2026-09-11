import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  EcommerceConfigDto,
  EcommerceConfigInputDto,
} from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import {
  AdministrationServiceError,
  ensureCanManageEcommerceConfig,
  ensureEcommerceConfigActor,
  ensureEcommerceConfigTenant,
  ensureEcommerceDefaultBranch,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeEcommerceConfigInput,
  validateEcommerceConfigInput,
} from "@/modules/administration/validation/ecommerceConfig.validation";

export class SaveEcommerceConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    dto: EcommerceConfigInputDto,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<EcommerceConfigDto> {
    ensureCanManageEcommerceConfig(permissions);
    ensureEcommerceConfigTenant(tenantId);
    ensureEcommerceConfigActor(actorUserId);

    // `tenantId` llega del caller (React): no alcanza para escribir la configuración de otro
    // tenant aunque coincida por accidente con el de la sesión real. Se resuelve el actor
    // autenticado por `actorUserId` y se exige que su `tenantId` coincida antes de mutar nada.
    const actor = await this.repositories.users.getById(actorUserId);
    if (!actor || actor.tenantId !== tenantId) {
      throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
    }

    validateEcommerceConfigInput(dto);

    const normalizedInput = normalizeEcommerceConfigInput(dto);
    const defaultBranch = normalizedInput.defaultBranchId
      ? await this.repositories.branches.getById(normalizedInput.defaultBranchId)
      : null;
    ensureEcommerceDefaultBranch(
      normalizedInput.enabled,
      normalizedInput.defaultBranchId,
      defaultBranch,
      tenantId,
    );

    const config = await this.repositories.businessConfig.updateEcommerceConfig(
      tenantId,
      normalizedInput,
    );
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "ecommerce_config.updated",
      entityType: "EcommerceConfig",
      entityId: tenantId,
      metadata: {
        enabled: config.enabled,
        storeName: config.storeName,
        defaultBranchId: config.defaultBranchId,
      },
    });

    return toEcommerceConfigDto(config);
  }
}
