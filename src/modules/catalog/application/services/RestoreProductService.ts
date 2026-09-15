import { ProductStatus } from "@/core/enums";
import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureCanUpdateProducts,
  ensureProduct,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class RestoreProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<Product> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanUpdateProducts(permissions);
    const product = ensureProduct(
      await this.repositories.products.getByIdScoped(tenantId, productId),
    );
    try {
      return await this.repositories.products.updateScoped(tenantId, product.id, {
        status: ProductStatus.published,
      });
    } catch {
      throw new CatalogServiceError("No se pudo restaurar el producto.");
    }
  }
}
