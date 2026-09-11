import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  EcommerceConfigDto,
  EcommerceConfigInputDto,
} from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import {
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
    validateEcommerceConfigInput(dto);

    const normalizedInput = normalizeEcommerceConfigInput(dto);
    const defaultBranch = normalizedInput.defaultBranchId
      ? await this.repositories.branches.getById(normalizedInput.defaultBranchId)
      : null;
    ensureEcommerceDefaultBranch(normalizedInput.enabled, defaultBranch, tenantId);

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
