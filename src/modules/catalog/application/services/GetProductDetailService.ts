import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductMediaSource, selectPrimaryProductMedia } from "@/core/media/catalogImage";
import type { ProductDetailViewModel } from "@/modules/catalog/types/catalog.types";
import { resolveTenantId } from "@/modules/catalog/application/services/serviceHelpers";

export class GetProductDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<ProductDetailViewModel | null> {
    const tenantId = await resolveTenantId(this.repositories);
    const product = await this.repositories.products.getByIdScoped(tenantId, productId);
    if (!product) return null;

    const [media, category, unit] = await Promise.all([
      this.repositories.productMedia.getByProduct(product.id),
      this.repositories.categories.getByIdScoped(tenantId, product.categoryId),
      this.repositories.units.getByIdScoped(tenantId, product.baseUnitId),
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
