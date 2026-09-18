import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { getProductMediaSource, selectPrimaryProductMedia } from "@/core/media/catalogImage";
import type { ProductListItem } from "@/modules/catalog/types/catalog.types";
import { ProductStatus, PromotionStatus, PromotionType } from "@/core/enums";
import type { Promotion } from "@/core/entities";
import { calculateEffectivePrice } from "@/core/pricing";
import { formatCurrency } from "@/shared/utils/formatCurrency";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { ProductType } from "@/core/enums";
import {
  ensureCanReadProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

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

  async execute(branchId?: string): Promise<ProductListItem[]> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanReadProducts(permissions);
    const [products, categories, promotions] = await Promise.all([
      this.repositories.products.getByTenant(tenantId),
      this.repositories.categories.getByTenant(tenantId),
      this.repositories.promotions.getActiveByTenant(tenantId),
    ]);
    const units = await this.repositories.units.getByTenant(tenantId);
    const locations = branchId ? await this.repositories.inventory.getLocations(branchId) : [];
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

    return Promise.all(products.map(async (product): Promise<ProductListItem> => {
        const activePromotion =
          product.status === ProductStatus.published
            ? getCurrentPromotion(product.id, product.tenantId, promotions, now)
            : undefined;
        const effectivePrice = activePromotion
          ? calculateEffectivePrice(product.salePrice, activePromotion).effectivePrice
          : product.salePrice;

        const balances = branchId && product.productType === ProductType.physical && product.tracking.stock
          ? await this.repositories.inventory.getBalanceByProduct(product.id, branchId)
          : [];
        return {
          id: product.id,
          tenantId: product.tenantId,
          imageSource: getPrimaryImageSource(
            mediaByProduct.get(product.id) ?? [],
            product.tenantId,
          ),
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
          availableQuantity: branchId && product.productType === ProductType.physical && product.tracking.stock
            ? getBranchAvailableQuantity({ tenantId, branchId, productId: product.id, balances, locations })
            : undefined,
        };
      }))
      .then((items) => items.sort((left, right) => left.name.localeCompare(right.name)));
  }
}

function getPrimaryImageSource(
  media: Awaited<ReturnType<RepositoryRegistry["productMedia"]["getByProduct"]>>,
  tenantId: string,
) {
  const primary = selectPrimaryProductMedia(media.filter((item) => item.tenantId === tenantId));
  return primary ? (getProductMediaSource(primary) ?? undefined) : undefined;
}
