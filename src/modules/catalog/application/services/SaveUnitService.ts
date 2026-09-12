import { UnitStatus } from "@/core/enums";
import type { Unit } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { UnitEditorDto } from "@/modules/catalog/application/dto/UnitEditorDto";
import {
  CatalogServiceError,
  resolveTenantId,
} from "@/modules/catalog/application/services/serviceHelpers";

export class SaveUnitService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async create(dto: UnitEditorDto): Promise<Unit> {
    const tenantId = await resolveTenantId(this.repositories);
    if (!tenantId) throw new CatalogServiceError("No se pudo resolver el negocio activo.");

    return this.repositories.units.create({
      tenantId,
      code: buildUnitCode(dto.symbol, dto.name),
      name: dto.name.trim(),
      symbol: dto.symbol.trim(),
      category: dto.category,
      allowsDecimals: dto.allowsDecimals,
      status: dto.status,
    });
  }

  async update(unitId: string, dto: UnitEditorDto): Promise<Unit> {
    return this.repositories.units.update(unitId, {
      name: dto.name.trim(),
      symbol: dto.symbol.trim(),
      category: dto.category,
      allowsDecimals: dto.allowsDecimals,
      status: dto.status,
    });
  }

  async archive(unitId: string): Promise<Unit> {
    return this.repositories.units.update(unitId, { status: UnitStatus.archived });
  }

  async restore(unitId: string): Promise<Unit> {
    return this.repositories.units.update(unitId, { status: UnitStatus.active });
  }
}

function buildUnitCode(symbol: string, fallbackName: string) {
  const source = symbol.trim() || fallbackName.trim();
  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "UNIDAD";
}
