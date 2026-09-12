import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import {
  syncEditorRelatedData,
  validateEditorProduct,
} from "@/modules/catalog/application/services/productEditorHelpers";
import { resolveTenantId } from "@/modules/catalog/application/services/serviceHelpers";
import { CatalogServiceError } from "@/modules/catalog/application/services/serviceHelpers";

export class CreateProductWithCommercialDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(dto: ProductEditorDto): Promise<Product> {
    const tenantId = await resolveTenantId(this.repositories);
    if (!tenantId) {
      throw new CatalogServiceError("No hay un negocio disponible para crear productos.");
    }

    const { normalizedDto, productInput, capabilities, isNewProduct } = await validateEditorProduct(
      this.repositories,
      dto,
      tenantId,
    );
    const product = await this.repositories.products.create(productInput);
    await syncEditorRelatedData(this.repositories, product, normalizedDto, {
      capabilities,
      isNewProduct,
    });
    return product;
  }
}
