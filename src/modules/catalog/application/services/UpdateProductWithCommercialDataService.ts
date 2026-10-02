import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import { ProductMapper } from "@/modules/catalog/application/mappers/ProductMapper";
import {
  ensureApiEditorHasOnlyProductCore,
  syncEditorRelatedData,
  toProductDto,
  validateEditorProduct,
} from "@/modules/catalog/application/services/productEditorHelpers";
import {
  CatalogServiceError,
  ensureCanUpdateProducts,
  ensureProduct,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class UpdateProductWithCommercialDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string, dto: ProductEditorDto): Promise<Product> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanUpdateProducts(permissions);
    const current = ensureProduct(
      await this.repositories.products.getByIdScoped(tenantId, productId),
    );
    const { normalizedDto, capabilities, isNewProduct } = await validateEditorProduct(
      this.repositories,
      dto,
      current.tenantId,
      current,
    );
    ensureApiEditorHasOnlyProductCore(this.repositories, normalizedDto);
    if (
      this.repositories.productDataSource === "api" &&
      (Number(normalizedDto.salePrice) !== current.salePrice ||
        normalizedDto.status !== current.status)
    ) {
      throw new CatalogServiceError(
        "El precio y el estado usan flujos dedicados en Products API. El producto no fue modificado.",
      );
    }
    const updated = await this.repositories.products.updateScoped(
      tenantId,
      current.id,
      ProductMapper.toUpdateInput(toProductDto(normalizedDto), current),
    );
    if (this.repositories.productDataSource === "mock") {
      await syncEditorRelatedData(this.repositories, updated, normalizedDto, {
        capabilities,
        isNewProduct,
      });
    }
    return updated;
  }
}
