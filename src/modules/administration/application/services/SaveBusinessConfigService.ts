import { BusinessPreset } from "@/core/enums";
import { businessDefaultsConfig } from "@/config/business-defaults";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { BusinessConfigDto } from "@/modules/administration/application/dto/BusinessConfigDto";
import { toBusinessConfigDto } from "@/modules/administration/application/mappers/BusinessConfigMapper";
import {
  AdministrationServiceError,
  ensureCanManageBusinessConfig,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  hasBusinessConfigValidationErrors,
  validateBusinessConfigDto,
} from "@/modules/administration/validation/businessConfig.validation";

export class SaveBusinessConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    dto: BusinessConfigDto,
    permissions: readonly string[],
  ): Promise<BusinessConfigDto> {
    ensureCanManageBusinessConfig(permissions);
    ensureCoherentDto(dto);

    const config = await this.repositories.businessConfig.updateCapabilities(tenantId, {
      ...dto,
      preset: resolvePreset(dto),
      defaultProductTracking: { ...dto.defaultProductTracking },
    });

    return toBusinessConfigDto(config);
  }
}

/**
 * La coherencia entre capacidades y trazabilidad es una invariante del negocio, no una regla de
 * formulario: cualquier consumidor del service debe respetarla, no solo la pantalla.
 */
function ensureCoherentDto(dto: BusinessConfigDto) {
  const errors = validateBusinessConfigDto(dto);
  if (!hasBusinessConfigValidationErrors(errors)) return;

  throw new AdministrationServiceError(
    errors.inventory ?? errors.tracking ?? "La configuración del negocio no es coherente.",
  );
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
