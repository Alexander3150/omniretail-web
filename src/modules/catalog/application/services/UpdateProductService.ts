import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { normalizeSku } from "@/shared/utils/normalizeSku";
import type { UpdateProductDto } from "@/modules/catalog/application/dto/UpdateProductDto";
import { ProductMapper } from "@/modules/catalog/application/mappers/ProductMapper";
import {
  applyTrackingRules,
  hasValidationErrors,
  resolveSaleUnitId,
  validateProductDto,
} from "@/modules/catalog/validation/product.validation";
import {
  CatalogServiceError,
  ensureActiveCategory,
  ensureActiveUnit,
  ensureProduct,
  ensureProductTypeAllowed,
  ensureUnitConfigUnchanged,
  requireCapabilities,
} from "@/modules/catalog/application/services/serviceHelpers";

export class UpdateProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string, dto: UpdateProductDto): Promise<Product> {
    const baseErrors = validateProductDto(dto);
    if (hasValidationErrors(baseErrors)) {
      throw new CatalogServiceError(
        Object.values(baseErrors)[0] ?? "Revisa los datos del producto.",
      );
    }

    const current = ensureProduct(await this.repositories.products.getById(productId));
    const normalizedSku = normalizeSku(dto.sku);
    const duplicateSku = await this.repositories.products.getBySku(normalizedSku);
    if (duplicateSku && duplicateSku.id !== current.id) {
      throw new CatalogServiceError("Ya existe un producto con este Codigo / SKU.");
    }

    if (dto.barcode?.trim()) {
      const products = await this.repositories.products.getAll();
      const duplicateBarcode = products.find(
        (product) => product.barcode === dto.barcode?.trim() && product.id !== current.id,
      );
      if (duplicateBarcode) {
        throw new CatalogServiceError("Ya existe un producto con este codigo de barras.");
      }
    }

    const [category, unit] = await Promise.all([
      this.repositories.categories.getById(dto.categoryId),
      this.repositories.units.getById(dto.baseUnitId),
    ]);
    ensureActiveCategory(category);
    ensureActiveUnit(unit);

    const capabilities = await requireCapabilities(this.repositories, current.tenantId);
    ensureProductTypeAllowed(dto.productType, capabilities, current.productType);
    ensureUnitConfigUnchanged(dto, capabilities, current);
    // Producto existente: se conserva lo ya persistido (unidad de venta y tracking) en vez de
    // recortarlo si la capacidad correspondiente esta apagada. Ver product.validation.ts.
    const saleUnitId = resolveSaleUnitId(
      dto.baseUnitId,
      dto.saleUnitId,
      capabilities,
      current.saleUnitId ?? current.baseUnitId,
    );
    const tracking = applyTrackingRules(
      dto.productType,
      dto.tracking,
      capabilities,
      current.tracking,
    );
    const updated = await this.repositories.products.update(
      current.id,
      ProductMapper.toUpdateInput({ ...dto, sku: normalizedSku, saleUnitId, tracking }, current),
    );

    await this.syncPrimaryImage(updated, dto.primaryImageUrl?.trim() ?? "");

    return updated;
  }

  private async syncPrimaryImage(product: Product, primaryImageUrl: string) {
    const primaryMedia = await this.repositories.productMedia.getPrimaryByProduct(product.id);

    if (!primaryImageUrl) {
      if (primaryMedia) await this.repositories.productMedia.remove(primaryMedia.id);
      return;
    }

    if (primaryMedia) {
      if (primaryMedia.url !== primaryImageUrl || primaryMedia.alt !== product.name) {
        await this.repositories.productMedia.update({
          ...primaryMedia,
          url: primaryImageUrl,
          alt: product.name,
          isPrimary: true,
        });
      }
      return;
    }

    await this.repositories.productMedia.add({
      tenantId: product.tenantId,
      productId: product.id,
      type: "image",
      url: primaryImageUrl,
      alt: product.name,
      isPrimary: true,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
    });
  }
}
