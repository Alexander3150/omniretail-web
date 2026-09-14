import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureProduct,
  resolveTenantId,
} from "@/modules/catalog/application/services/serviceHelpers";

export class ArchiveProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<Product> {
    const tenantId = await resolveTenantId(this.repositories);
    ensureProduct(await this.repositories.products.getByIdScoped(tenantId, productId));
    try {
      return await this.repositories.products.archiveScoped(tenantId, productId);
    } catch {
      throw new CatalogServiceError("No se pudo archivar el producto.");
    }
  }
}
