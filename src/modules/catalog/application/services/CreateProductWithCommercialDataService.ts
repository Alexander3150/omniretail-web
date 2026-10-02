import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import {
  ensureApiEditorHasOnlyProductCore,
  syncEditorRelatedData,
  validateEditorProduct,
} from "@/modules/catalog/application/services/productEditorHelpers";
import {
  CatalogServiceError,
  ensureCanCreateProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class CreateProductWithCommercialDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: ProductEditorDto): Promise<Product> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanCreateProducts(permissions);
    if (!tenantId) {
      throw new CatalogServiceError("No hay un negocio disponible para crear productos.");
    }

    const { normalizedDto, productInput, capabilities, isNewProduct } = await validateEditorProduct(
      this.repositories,
      dto,
      tenantId,
    );
    ensureApiEditorHasOnlyProductCore(this.repositories, normalizedDto);
    const product = await this.repositories.products.create(productInput);
    if (this.repositories.productDataSource === "mock") {
      await syncEditorRelatedData(this.repositories, product, normalizedDto, {
        capabilities,
        isNewProduct,
      });
    }
    return product;
  }
}
