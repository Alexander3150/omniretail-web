import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  EcommerceConfigDto,
  EcommerceConfigInputDto,
} from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import { resolveEcommerceConfigAdminContext } from "@/modules/administration/application/services/resolveEcommerceConfigAdminContext";
import { ensureEcommerceDefaultBranch } from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeEcommerceConfigInput,
  validateEcommerceConfigInput,
} from "@/modules/administration/validation/ecommerceConfig.validation";

export class SaveEcommerceConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: EcommerceConfigInputDto): Promise<EcommerceConfigDto> {
    const { tenantId, actorUserId } = await resolveEcommerceConfigAdminContext(this.repositories);
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
