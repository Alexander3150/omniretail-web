import { LocationStatus } from "@/core/enums";
import type { StorageLocation } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { LocationEditorDto } from "@/modules/catalog/application/dto/LocationEditorDto";
import {
  CatalogServiceError,
  ensureCanManageLocations,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";
import { getReferenceDataCache, referenceDataPrefixes } from "@/shared/utils/requestCache";
import { normalizeLocationCode } from "@/modules/catalog/validation/location.validation";

export class SaveLocationService {
  private readonly referenceCache;

  constructor(private readonly repositories: RepositoryRegistry) {
    this.referenceCache = getReferenceDataCache(repositories);
  }

  async create(dto: LocationEditorDto): Promise<StorageLocation> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageLocations(permissions);
    if (!tenantId) throw new CatalogServiceError("No se pudo resolver el negocio activo.");

    const saved = await this.repositories.inventory.createLocation({
      tenantId,
      branchId: dto.branchId,
      parentId: dto.parentId || undefined,
      code: resolveCode(dto),
      name: dto.name.trim(),
      type: dto.type,
      description: cleanDescription(dto.description),
      status: dto.status,
    });
    this.referenceCache.invalidatePrefix(referenceDataPrefixes.locations);
    return saved;
  }

  async update(locationId: string, dto: LocationEditorDto): Promise<StorageLocation> {
    const { permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageLocations(permissions);
    const saved = await this.repositories.inventory.updateLocation(locationId, {
      branchId: dto.branchId,
      parentId: dto.parentId || undefined,
      code: resolveCode(dto),
      name: dto.name.trim(),
      description: cleanDescription(dto.description),
      status: dto.status,
    });
    this.referenceCache.invalidatePrefix(referenceDataPrefixes.locations);
    return saved;
  }

  async archive(locationId: string): Promise<StorageLocation> {
    const { permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageLocations(permissions);
    const saved = await this.repositories.inventory.updateLocation(locationId, {
      status: LocationStatus.archived,
    });
    this.referenceCache.invalidatePrefix(referenceDataPrefixes.locations);
    return saved;
  }

  async restore(locationId: string): Promise<StorageLocation> {
    const { permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageLocations(permissions);
    const saved = await this.repositories.inventory.updateLocation(locationId, {
      status: LocationStatus.active,
    });
    this.referenceCache.invalidatePrefix(referenceDataPrefixes.locations);
    return saved;
  }
}

function resolveCode(dto: LocationEditorDto) {
  return normalizeLocationCode(dto.code || dto.name);
}

function cleanDescription(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
