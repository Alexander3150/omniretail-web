import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureProduct,
} from "@/modules/catalog/application/services/serviceHelpers";

export class ArchiveProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<Product> {
    ensureProduct(await this.repositories.products.getById(productId));
    try {
      return await this.repositories.products.archive(productId);
    } catch {
      throw new CatalogServiceError("No se pudo archivar el producto.");
    }
  }
}
