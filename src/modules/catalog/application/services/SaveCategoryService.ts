import { CategoryStatus } from "@/core/enums";
import type { Category } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CategoryEditorDto } from "@/modules/catalog/application/dto/CategoryEditorDto";
import {
  CatalogServiceError,
  resolveTenantId,
} from "@/modules/catalog/application/services/serviceHelpers";
import { normalizeCategoryCode } from "@/modules/catalog/validation/category.validation";

export class SaveCategoryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async create(dto: CategoryEditorDto): Promise<Category> {
    const tenantId = await resolveTenantId(this.repositories);
    if (!tenantId) throw new CatalogServiceError("No se pudo resolver el negocio activo.");

    return this.repositories.categories.create({
      tenantId,
      parentId: dto.parentId || undefined,
      name: dto.name.trim(),
      slug: normalizeCategoryCode(dto.code),
      description: cleanDescription(dto.description),
      status: dto.status,
    });
  }

  async update(categoryId: string, dto: CategoryEditorDto): Promise<Category> {
    return this.repositories.categories.update(categoryId, {
      parentId: dto.parentId || undefined,
      name: dto.name.trim(),
      slug: normalizeCategoryCode(dto.code),
      description: cleanDescription(dto.description),
      status: dto.status,
    });
  }

  async archive(categoryId: string): Promise<Category> {
    return this.repositories.categories.archive(categoryId);
  }

  async restore(categoryId: string): Promise<Category> {
    return this.repositories.categories.update(categoryId, { status: CategoryStatus.active });
  }
}

function cleanDescription(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
