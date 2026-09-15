import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureCanUpdateProducts,
  ensureProduct,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class ArchiveProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<Product> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanUpdateProducts(permissions);
    ensureProduct(await this.repositories.products.getByIdScoped(tenantId, productId));
    try {
      return await this.repositories.products.archiveScoped(tenantId, productId);
    } catch {
      throw new CatalogServiceError("No se pudo archivar el producto.");
    }
  }
}
