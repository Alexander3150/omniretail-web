import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductImage } from "@/shared/utils/getProductImage";
import type { ProductDetailViewModel } from "@/modules/catalog/types/catalog.types";

export class GetProductDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<ProductDetailViewModel | null> {
    const product = await this.repositories.products.getById(productId);
    if (!product) return null;

    const [media, primaryMedia, category, unit] = await Promise.all([
      this.repositories.productMedia.getByProduct(product.id),
      this.repositories.productMedia.getPrimaryByProduct(product.id),
      this.repositories.categories.getById(product.categoryId),
      this.repositories.units.getById(product.baseUnitId),
    ]);

    return {
      product,
      imageUrl: getProductImage(media),
      primaryImageUrl: primaryMedia?.url ?? "",
      category,
      unit,
    };
  }
}
