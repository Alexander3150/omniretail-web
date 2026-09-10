import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { EcommerceConfigDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import {
  AdministrationServiceError,
  ensureCanManageEcommerceConfig,
  ensureEcommerceConfigTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetEcommerceConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<EcommerceConfigDto> {
    ensureCanManageEcommerceConfig(permissions);
    ensureEcommerceConfigTenant(tenantId);
    const config = await this.repositories.businessConfig.getEcommerceConfig(tenantId);

    if (!config) {
      throw new AdministrationServiceError(
        "No se encontró la configuración de e-commerce del negocio.",
      );
    }

    return toEcommerceConfigDto(config);
  }
}
