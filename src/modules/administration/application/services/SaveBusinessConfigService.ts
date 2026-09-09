import type { BusinessCapabilitiesConfig } from "@/core/entities";
import { BusinessPreset } from "@/core/enums";
import { businessDefaultsConfig } from "@/config/business-defaults";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { BusinessConfigDto } from "@/modules/administration/application/dto/BusinessConfigDto";

export class SaveBusinessConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, dto: BusinessConfigDto): Promise<BusinessConfigDto> {
    const config = await this.repositories.businessConfig.updateCapabilities(tenantId, {
      ...dto,
      preset: resolvePreset(dto),
      defaultProductTracking: { ...dto.defaultProductTracking },
    });

    return toBusinessConfigDto(config);
  }
}

function resolvePreset(dto: BusinessConfigDto): BusinessPreset {
  if (dto.preset === BusinessPreset.custom) return BusinessPreset.custom;

  const defaults = businessDefaultsConfig[dto.preset];
  const matchesPreset =
    dto.supportsInventory === defaults.supportsInventory &&
    dto.supportsLots === defaults.supportsLots &&
    dto.supportsExpiration === defaults.supportsExpiration &&
    dto.supportsSerials === defaults.supportsSerials &&
    dto.supportsMultipleLocations === defaults.supportsMultipleLocations &&
    dto.supportsUnitsAndPackaging === defaults.supportsUnitsAndPackaging &&
    dto.supportsProductAttributes === defaults.supportsProductAttributes &&
    dto.supportsKits === defaults.supportsKits &&
    dto.supportsServices === defaults.supportsServices &&
    dto.defaultProductTracking.stock === defaults.defaultProductTracking.stock &&
    dto.defaultProductTracking.lot === defaults.defaultProductTracking.lot &&
    dto.defaultProductTracking.expiration === defaults.defaultProductTracking.expiration &&
    dto.defaultProductTracking.serial === defaults.defaultProductTracking.serial;

  return matchesPreset ? dto.preset : BusinessPreset.custom;
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
