import { CategoryStatus } from "@/core/enums";
import type { Category } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CategoryEditorDto } from "@/modules/catalog/application/dto/CategoryEditorDto";
import {
  CatalogServiceError,
  ensureCanManageCategories,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";
import { normalizeCategoryCode } from "@/modules/catalog/validation/category.validation";
import { removeAssetIfOrphaned } from "@/modules/catalog/application/services/productEditorHelpers";

export class SaveCategoryService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async create(dto: CategoryEditorDto): Promise<Category> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageCategories(permissions);
    if (!tenantId) throw new CatalogServiceError("No se pudo resolver el negocio activo.");

    await this.assertParentOwnership(tenantId, dto.parentId);
    await this.assertExistingImageOwnership(tenantId, dto);
    const newAssetId = await this.storePendingImage(tenantId, dto);
    try {
      return await this.repositories.categories.create({
        tenantId,
        parentId: dto.parentId || undefined,
        name: dto.name.trim(),
        slug: normalizeCategoryCode(dto.code),
        description: cleanDescription(dto.description),
        image: newAssetId ? { kind: "mockAsset", assetId: newAssetId } : dto.image,
        status: dto.status,
      });
    } catch (error) {
      if (newAssetId) await this.repositories.catalogImageAssets.remove(tenantId, newAssetId);
      throw error;
    }
  }

  async update(categoryId: string, dto: CategoryEditorDto): Promise<Category> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageCategories(permissions);
    const current = await this.repositories.categories.getByIdScoped(tenantId, categoryId);
    if (!current) {
      throw new CatalogServiceError("No se pudo resolver la categoria actual.");
    }
    await this.assertParentOwnership(tenantId, dto.parentId, categoryId);
    await this.assertExistingImageOwnership(tenantId, dto);
    const newAssetId = await this.storePendingImage(tenantId, dto);
    const previousAssetId = current.image?.kind === "mockAsset" ? current.image.assetId : undefined;
    let updated: Category;
    try {
      updated = await this.repositories.categories.updateScoped(tenantId, categoryId, {
        parentId: dto.parentId || undefined,
        name: dto.name.trim(),
        slug: normalizeCategoryCode(dto.code),
        description: cleanDescription(dto.description),
        image: dto.removeImage
          ? undefined
          : newAssetId
            ? { kind: "mockAsset", assetId: newAssetId }
            : dto.image,
        status: dto.status,
      });
    } catch (error) {
      if (newAssetId) await this.repositories.catalogImageAssets.remove(tenantId, newAssetId);
      throw error;
    }
    const updatedAssetId = updated.image?.kind === "mockAsset" ? updated.image.assetId : undefined;
    if (previousAssetId && previousAssetId !== updatedAssetId) {
      await removeAssetIfOrphaned(this.repositories, tenantId, previousAssetId);
    }
    return updated;
  }

  private async storePendingImage(tenantId: string, dto: CategoryEditorDto) {
    if (!dto.pendingImage) return null;
    const id = crypto.randomUUID();
    await this.repositories.catalogImageAssets.put(
      {
        id,
        tenantId,
        mimeType: dto.pendingImage.mimeType,
        byteSize: dto.pendingImage.byteSize,
        width: dto.pendingImage.width,
        height: dto.pendingImage.height,
        createdAt: new Date().toISOString(),
      },
      dto.pendingImage.blob,
    );
    return id;
  }

  private async assertExistingImageOwnership(tenantId: string, dto: CategoryEditorDto) {
    if (dto.pendingImage || dto.removeImage || dto.image?.kind !== "mockAsset") return;
    const asset = await this.repositories.catalogImageAssets.get(tenantId, dto.image.assetId);
    if (!asset) throw new CatalogServiceError("La imagen local ya no esta disponible.");
  }

  async archive(categoryId: string): Promise<Category> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageCategories(permissions);
    return this.repositories.categories.archiveScoped(tenantId, categoryId);
  }

  private async assertParentOwnership(tenantId: string, parentId?: string, categoryId?: string) {
    if (!parentId) return;
    if (parentId === categoryId) {
      throw new CatalogServiceError("Una categoria no puede ser su propia categoria padre.");
    }
    if (!(await this.repositories.categories.getByIdScoped(tenantId, parentId))) {
      throw new CatalogServiceError("La categoria padre no esta disponible.");
    }
  }

  async restore(categoryId: string): Promise<Category> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanManageCategories(permissions);
    return this.repositories.categories.updateScoped(tenantId, categoryId, {
      status: CategoryStatus.active,
    });
  }
}

function cleanDescription(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}
