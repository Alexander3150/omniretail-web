import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductMediaSource, selectPrimaryProductMedia } from "@/core/media/catalogImage";
import type { ProductDetailViewModel } from "@/modules/catalog/types/catalog.types";

export class GetProductDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<ProductDetailViewModel | null> {
    const product = await this.repositories.products.getById(productId);
    if (!product) return null;

    const [media, category, unit] = await Promise.all([
      this.repositories.productMedia.getByProduct(product.id),
      this.repositories.categories.getById(product.categoryId),
      this.repositories.units.getById(product.baseUnitId),
    ]);

    const primaryMedia = selectPrimaryProductMedia(
      media.filter((item) => item.tenantId === product.tenantId),
    );
    return {
      product,
      imageSource: primaryMedia ? (getProductMediaSource(primaryMedia) ?? undefined) : undefined,
      category,
      unit,
    };
  }
}
