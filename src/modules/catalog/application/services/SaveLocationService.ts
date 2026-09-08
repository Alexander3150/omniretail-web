import { LocationStatus } from "@/core/enums";
import type { StorageLocation } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { LocationEditorDto } from "@/modules/catalog/application/dto/LocationEditorDto";
import { CatalogServiceError, resolveTenantId } from "@/modules/catalog/application/services/serviceHelpers";
import { normalizeLocationCode } from "@/modules/catalog/validation/location.validation";

export class SaveLocationService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async create(dto: LocationEditorDto): Promise<StorageLocation> {
    const tenantId = await resolveTenantId(this.repositories);
    if (!tenantId) throw new CatalogServiceError("No se pudo resolver el negocio activo.");

    return this.repositories.inventory.createLocation({
      tenantId,
      branchId: dto.branchId,
      parentId: undefined,
      code: resolveCode(dto),
      name: dto.name.trim(),
      type: "warehouse",
      description: cleanDescription(dto.description),
      status: dto.status,
    });
  }

  async update(locationId: string, dto: LocationEditorDto): Promise<StorageLocation> {
    return this.repositories.inventory.updateLocation(locationId, {
      branchId: dto.branchId,
      parentId: dto.parentId || undefined,
      code: resolveCode(dto),
      name: dto.name.trim(),
      description: cleanDescription(dto.description),
      status: dto.status,
    });
  }

  async archive(locationId: string): Promise<StorageLocation> {
    return this.repositories.inventory.updateLocation(locationId, { status: LocationStatus.archived });
  }

  async restore(locationId: string): Promise<StorageLocation> {
    return this.repositories.inventory.updateLocation(locationId, { status: LocationStatus.active });
  }
}

function resolveCode(dto: LocationEditorDto) {
  return normalizeLocationCode(dto.code || dto.name);
}

function cleanDescription(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
