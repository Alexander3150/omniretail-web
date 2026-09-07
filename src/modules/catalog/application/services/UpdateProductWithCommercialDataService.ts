import type { Product } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProductEditorDto } from "@/modules/catalog/application/dto/ProductEditorDto";
import { ProductMapper } from "@/modules/catalog/application/mappers/ProductMapper";
import {
  syncEditorRelatedData,
  toProductDto,
  validateEditorProduct,
} from "@/modules/catalog/application/services/productEditorHelpers";
import { ensureProduct } from "@/modules/catalog/application/services/serviceHelpers";

export class UpdateProductWithCommercialDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string, dto: ProductEditorDto): Promise<Product> {
    const current = ensureProduct(await this.repositories.products.getById(productId));
    await validateEditorProduct(this.repositories, dto, current.tenantId, current.id);
    const updated = await this.repositories.products.update(
      current.id,
      ProductMapper.toUpdateInput(toProductDto(dto), current),
    );
    await syncEditorRelatedData(this.repositories, updated, dto);
    return updated;
  }
}
