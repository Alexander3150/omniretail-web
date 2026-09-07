import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductImage } from "@/shared/utils/getProductImage";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { PromotionStatus, PromotionType } from "@/core/enums";
import type { Promotion } from "@/core/entities";
import { calculateEffectivePrice } from "@/core/pricing";
import { formatCurrency } from "@/shared/utils/formatCurrency";

function getCurrentPromotion(
  productId: string,
  tenantId: string,
  promotions: Promotion[],
  now: Date,
) {
  const timestamp = now.getTime();
  return promotions.find((promotion) => {
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

function formatPromotionLabel(promotion: Promotion) {
  const value =
    promotion.type === PromotionType.percentage
      ? `${promotion.value}% descuento`
      : promotion.type === PromotionType.fixedDiscount
        ? `${formatCurrency(promotion.value)} descuento`
        : `Precio ${formatCurrency(promotion.value)}`;

  return `${value} · Activa`;
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
      .map<ProductListItem>((product) => {
        const activePromotion = getCurrentPromotion(product.id, product.tenantId, promotions, now);
        const effectivePrice = activePromotion
          ? calculateEffectivePrice(product.salePrice, activePromotion).effectivePrice
          : product.salePrice;

        return {
          id: product.id,
          tenantId: product.tenantId,
          imageUrl: getProductImage(mediaByProduct.get(product.id) ?? []),
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          categoryName: categoryNames.get(product.categoryId) ?? "Sin categoría",
          categoryId: product.categoryId,
          baseUnitName: unitNames.get(product.baseUnitId) ?? "Sin unidad",
          baseUnitId: product.baseUnitId,
          productType: product.productType,
          salePrice: product.salePrice,
          channels: product.channels,
          hasActivePromotion: Boolean(activePromotion),
          activePromotion: activePromotion
            ? {
                id: activePromotion.id,
                label: formatPromotionLabel(activePromotion),
                effectivePrice,
              }
            : undefined,
          status: product.status,
          tracking: product.tracking,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
