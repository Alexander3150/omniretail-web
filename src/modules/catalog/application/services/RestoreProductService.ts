import { ProductStatus } from "@/core/enums";
import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  CatalogServiceError,
  ensureProduct,
} from "@/modules/catalog/application/services/serviceHelpers";

export class RestoreProductService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<Product> {
    const product = ensureProduct(await this.repositories.products.getById(productId));
    try {
      return await this.repositories.products.update(product.id, {
        status: ProductStatus.published,
      });
    } catch {
      throw new CatalogServiceError("No se pudo restaurar el producto.");
    }
  }
}

