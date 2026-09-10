import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { normalizeSku } from "@/shared/utils/normalizeSku";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
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
  ensureProductTypeAllowed,
  requireCapabilities,
  resolveTenantId,
} from "@/modules/catalog/application/services/serviceHelpers";

export class CreateProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: CreateProductDto): Promise<Product> {
    const baseErrors = validateProductDto(dto);
    if (hasValidationErrors(baseErrors)) {
      throw new CatalogServiceError(
        Object.values(baseErrors)[0] ?? "Revisa los datos del producto.",
      );
    }

    const normalizedSku = normalizeSku(dto.sku);
    const duplicateSku = await this.repositories.products.getBySku(normalizedSku);
    if (duplicateSku) throw new CatalogServiceError("Ya existe un producto con este Codigo / SKU.");

    if (dto.barcode?.trim()) {
      const products = await this.repositories.products.getAll();
      const duplicateBarcode = products.find((product) => product.barcode === dto.barcode?.trim());
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

    const tenantId =
      category?.tenantId ?? unit?.tenantId ?? (await resolveTenantId(this.repositories));
    if (!tenantId)
      throw new CatalogServiceError("No hay un negocio disponible para crear productos.");

    const capabilities = await requireCapabilities(this.repositories, tenantId);
    ensureProductTypeAllowed(dto.productType, capabilities);
    const saleUnitId = resolveSaleUnitId(dto.baseUnitId, dto.saleUnitId, capabilities);
    const tracking = applyTrackingRules(dto.productType, dto.tracking, capabilities);
    const product = await this.repositories.products.create(
      ProductMapper.toCreateInput({ ...dto, sku: normalizedSku, saleUnitId, tracking }, tenantId),
    );

    if (dto.primaryImageUrl?.trim()) {
      await this.repositories.productMedia.add({
        tenantId,
        productId: product.id,
        type: "image",
        url: dto.primaryImageUrl.trim(),
        alt: product.name,
        isPrimary: true,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      });
    }

    return product;
  }
}
