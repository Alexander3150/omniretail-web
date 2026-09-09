import type { BusinessCapabilitiesConfig } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { BusinessConfigDto } from "@/modules/administration/application/dto/BusinessConfigDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

export class GetBusinessConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string): Promise<BusinessConfigDto> {
    const config = await this.repositories.businessConfig.getCapabilities(tenantId);
    if (!config) {
      throw new AdministrationServiceError("La configuración del negocio no está disponible.");
    }

    return toBusinessConfigDto(config);
  }
}

function toBusinessConfigDto(config: BusinessCapabilitiesConfig): BusinessConfigDto {
  return {
    preset: config.preset,
    supportsInventory: config.supportsInventory,
    supportsLots: config.supportsLots,
    supportsExpiration: config.supportsExpiration,
    supportsSerials: config.supportsSerials,
    supportsMultipleLocations: config.supportsMultipleLocations,
    supportsUnitsAndPackaging: config.supportsUnitsAndPackaging,
    supportsProductAttributes: config.supportsProductAttributes,
    supportsKits: config.supportsKits,
    supportsServices: config.supportsServices,
    defaultProductTracking: { ...config.defaultProductTracking },
  };
}
