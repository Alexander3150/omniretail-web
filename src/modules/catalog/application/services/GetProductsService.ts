import type { Promotion } from "@/core/entities";
import { ProductStatus, ProductType, PromotionStatus, PromotionType } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import { getProductMediaSource, selectPrimaryProductMedia } from "@/core/media/catalogImage";
import { calculateEffectivePrice } from "@/core/pricing";
import type { ProductPageParams } from "@/core/repositories/ProductRepository";
import type { PaginatedResult } from "@/core/types/pagination.types";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  ensureCanReadProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";
import type {
  ProductFiltersState,
  ProductListItem,
} from "@/modules/catalog/types/catalog.types";
import { formatCurrency } from "@/shared/utils/formatCurrency";

const MOCK_FETCH_PAGE_SIZE = 100;

export interface GetProductsParams extends ProductPageParams {
  branchId?: string;
  filters: ProductFiltersState;
}

export class GetProductsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(params: GetProductsParams): Promise<PaginatedResult<ProductListItem>> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanReadProducts(permissions);

    if (this.repositories.productDataSource === "api") {
      return this.getApiPage(tenantId, params);
    }
    return this.getMockPage(tenantId, params);
  }

  private async getApiPage(tenantId: string, params: GetProductsParams) {
    const [page, categories, units] = await Promise.all([
      this.repositories.products.getPageScoped(tenantId, params),
      this.repositories.categories.getByTenant(tenantId),
      this.repositories.units.getByTenant(tenantId),
    ]);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));

    return {
      ...page,
      items: page.items.map((product): ProductListItem => ({
        id: product.id,
        tenantId: product.tenantId,
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
        hasActivePromotion: false,
        activePromotion: undefined,
        status: product.status,
        tracking: product.tracking,
        imageSource: undefined,
        availableQuantity: undefined,
      })),
    };
  }

  private async getMockPage(tenantId: string, params: GetProductsParams) {
    const products = await this.getAllMockProducts(tenantId, params.sort);
    const [categories, units, promotions] = await Promise.all([
      this.repositories.categories.getByTenant(tenantId),
      this.repositories.units.getByTenant(tenantId),
      this.repositories.promotions.getActiveByTenant(tenantId),
    ]);
    const locations = params.branchId
      ? await this.repositories.inventory.getLocations(params.branchId)
      : [];
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

    const enriched = await Promise.all(
      products.map(async (product): Promise<ProductListItem> => {
        const activePromotion =
          product.status === ProductStatus.published
            ? getCurrentPromotion(product.id, product.tenantId, promotions, now)
            : undefined;
        const effectivePrice = activePromotion
          ? calculateEffectivePrice(product.salePrice, activePromotion).effectivePrice
          : product.salePrice;
        const balances =
          params.branchId &&
          product.productType === ProductType.physical &&
          product.tracking.stock
            ? await this.repositories.inventory.getBalanceByProduct(product.id, params.branchId)
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
          categoryName: categoryNames.get(product.categoryId) ?? "Sin categoria",
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
          availableQuantity:
            params.branchId &&
            product.productType === ProductType.physical &&
            product.tracking.stock
              ? getBranchAvailableQuantity({
                  tenantId,
                  branchId: params.branchId,
                  productId: product.id,
                  balances,
                  locations,
                })
              : undefined,
        };
      }),
    );

    const filtered = filterProducts(enriched, params.filters);
    const totalPages = Math.ceil(filtered.length / params.pageSize);
    const page = Math.min(params.page, Math.max(1, totalPages));
    const start = (page - 1) * params.pageSize;
    return {
      items: filtered.slice(start, start + params.pageSize),
      page,
      pageSize: params.pageSize,
      totalItems: filtered.length,
      totalPages,
    };
  }

  private async getAllMockProducts(
    tenantId: string,
    sort: ProductPageParams["sort"],
  ) {
    const first = await this.repositories.products.getPageScoped(tenantId, {
      page: 1,
      pageSize: MOCK_FETCH_PAGE_SIZE,
      sort,
    });
    const products = [...first.items];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await this.repositories.products.getPageScoped(tenantId, {
        page,
        pageSize: MOCK_FETCH_PAGE_SIZE,
        sort,
      });
      products.push(...next.items);
    }
    return products;
  }
}

function filterProducts(products: ProductListItem[], filters: ProductFiltersState) {
  const query = filters.search.trim().toLowerCase();
  return products.filter((product) => {
    const matchesSearch =
      !query ||
      [product.name, product.sku, product.barcode, product.brand]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" || product.status === filters.status;
    const matchesType =
      filters.productType === "all" || product.productType === filters.productType;
    const matchesCategory =
      filters.categoryId === "all" || product.categoryId === filters.categoryId;
    const matchesChannel =
      filters.channels.length === 0 ||
      filters.channels.some((channel) => product.channels[channel]);
    const matchesPromotion =
      filters.promotion === "all" ||
      (filters.promotion === "with" && product.hasActivePromotion) ||
      (filters.promotion === "without" && !product.hasActivePromotion);
    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesCategory &&
      matchesChannel &&
      matchesPromotion
    );
  });
}

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
  return `${value} - Activa`;
}

function getPrimaryImageSource(
  media: Awaited<ReturnType<RepositoryRegistry["productMedia"]["getByProduct"]>>,
  tenantId: string,
) {
  const primary = selectPrimaryProductMedia(media.filter((item) => item.tenantId === tenantId));
  return primary ? (getProductMediaSource(primary) ?? undefined) : undefined;
}
