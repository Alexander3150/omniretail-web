import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductImage } from "@/shared/utils/getProductImage";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { PromotionStatus } from "@/core/enums";
import type { Promotion } from "@/core/entities";

function hasCurrentPromotion(productId: string, tenantId: string, promotions: Promotion[], now: Date) {
  const timestamp = now.getTime();
  return promotions.some((promotion) => {
    const startsAt = new Date(promotion.startAt).getTime();
    const endsAt = promotion.endAt ? new Date(promotion.endAt).getTime() : Number.POSITIVE_INFINITY;
    return (
      promotion.productIds.includes(productId) &&
      promotion.tenantId === tenantId &&
      promotion.status === PromotionStatus.active &&
      startsAt <= timestamp &&
      timestamp <= endsAt
    );
  });
}

export class GetProductsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(): Promise<ProductListItem[]> {
    const [products, categories, promotions] = await Promise.all([
      this.repositories.products.getAll(),
      this.repositories.categories.getAll(),
      this.repositories.promotions.getActive(),
    ]);
    const units = await this.repositories.units.getAll();
    const mediaEntries = await Promise.all(
      products.map(
        async (product) =>
          [product.id, await this.repositories.productMedia.getByProduct(product.id)] as const,
      ),
    );
    const mediaByProduct = new Map(mediaEntries);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    const now = new Date();

    return products
      .map<ProductListItem>((product) => ({
        id: product.id,
        tenantId: product.tenantId,
        imageUrl: getProductImage(mediaByProduct.get(product.id) ?? []),
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        categoryName: categoryNames.get(product.categoryId) ?? "Sin categoria",
        categoryId: product.categoryId,
        baseUnitName: unitNames.get(product.baseUnitId) ?? "Sin unidad",
        baseUnitId: product.baseUnitId,
        productType: product.productType,
        salePrice: product.salePrice,
        channels: product.channels,
        hasActivePromotion: hasCurrentPromotion(product.id, product.tenantId, promotions, now),
        status: product.status,
        tracking: product.tracking,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
