"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProductSalesPriceTier, Promotion } from "@/core/entities";
import { SalesChannel } from "@/core/enums";
import { calculateEffectivePrice, resolveQuantityPrice } from "@/core/pricing";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import {
  createStorefrontCartItem,
  type StorefrontCartItemDto,
} from "@/modules/storefront/application/dto/StorefrontCartDto";
import { GetStorefrontPublishedProductService } from "@/modules/storefront/application/services/GetStorefrontPublishedProductService";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

interface StorefrontCartContextValue {
  items: StorefrontCartItemDto[];
  itemCount: number;
  subtotal: number;
  addProduct: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
}

const StorefrontCartContext = createContext<StorefrontCartContextValue | null>(null);

type PricedStorefrontCartItem = StorefrontCartItemDto & {
  basePrice: number;
  salesPriceTiers: Array<Pick<ProductSalesPriceTier, "minQuantity" | "unitPrice" | "active">>;
  promotion?: Pick<Promotion, "id" | "type" | "value">;
};

function withQuantityPrice(item: PricedStorefrontCartItem, quantity: number): PricedStorefrontCartItem {
  const price = calculateEffectivePrice(
    resolveQuantityPrice({ basePrice: item.basePrice, quantity, tiers: item.salesPriceTiers }),
    item.promotion,
  );
  return { ...item, quantity, unitPrice: price.effectivePrice };
}

export function StorefrontCartProvider({ children }: { children: ReactNode }) {
  const repositories = useRepositories();
  const { tenantId } = usePublicTenant();
  const publishedProductService = useMemo(
    () => new GetStorefrontPublishedProductService(repositories),
    [repositories],
  );
  const [allItems, setAllItems] = useState<PricedStorefrontCartItem[]>([]);
  const items = useMemo(
    () => allItems.filter((item) => item.tenantId === tenantId),
    [allItems, tenantId],
  );
  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [items],
  );

  const addProduct = useCallback(
    async (productId: string) => {
      if (!tenantId) return;
      const product = await publishedProductService.execute(tenantId, productId);
      if (!product) return;
      const ecommerceConfig = await repositories.businessConfig.getEcommerceConfig(tenantId);
      if (!ecommerceConfig?.defaultBranchId) return;
      const [primaryMedia, salesPriceTiers, promotion] = await Promise.all([
        repositories.productMedia.getPrimaryByProduct(product.id),
        repositories.productSalesPriceTiers.getByProduct(product.id),
        repositories.promotions.getApplicable({
          tenantId,
          productId: product.id,
          at: new Date().toISOString(),
          channel: SalesChannel.ecommerce,
          branchId: ecommerceConfig.defaultBranchId,
        }),
      ]);
      const media =
        primaryMedia?.tenantId === tenantId && primaryMedia.type === "image"
          ? { imageUrl: primaryMedia.url, imageAlt: primaryMedia.alt }
          : undefined;

      setAllItems((current) => {
        const existing = current.find(
          (item) => item.tenantId === tenantId && item.productId === product.id,
        );
        const pricingContext = {
          basePrice: product.salePrice,
          salesPriceTiers: salesPriceTiers
            .filter((tier) => tier.tenantId === tenantId && tier.productId === product.id && tier.active)
            .map(({ minQuantity, unitPrice, active }) => ({ minQuantity, unitPrice, active })),
          promotion: promotion ?? undefined,
        };
        if (!existing)
          return [
            withQuantityPrice(
              { ...createStorefrontCartItem(product, media), ...pricingContext },
              1,
            ),
          ];

        return current.map((item) =>
          item === existing
            ? withQuantityPrice({
                ...item,
                sku: product.sku,
                name: product.name,
                ...media,
                ...pricingContext,
              }, item.quantity + 1)
            : item,
        );
      });
    },
    [publishedProductService, repositories, tenantId],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (!tenantId) return;
      if (!Number.isFinite(quantity)) return;
      const nextQuantity = Math.floor(quantity);
      setAllItems((current) =>
        nextQuantity <= 0
          ? current.filter((item) => item.tenantId !== tenantId || item.productId !== productId)
          : current.map((item) =>
              item.tenantId === tenantId && item.productId === productId
                ? withQuantityPrice(item, nextQuantity)
                : item,
            ),
      );
    },
    [tenantId],
  );

  const removeProduct = useCallback(
    (productId: string) => updateQuantity(productId, 0),
    [updateQuantity],
  );
  const clearCart = useCallback(() => {
    if (!tenantId) return;
    setAllItems((current) => current.filter((item) => item.tenantId !== tenantId));
  }, [tenantId]);

  const value = useMemo<StorefrontCartContextValue>(
    () => ({ items, itemCount, subtotal, addProduct, updateQuantity, removeProduct, clearCart }),
    [addProduct, clearCart, itemCount, items, removeProduct, subtotal, updateQuantity],
  );

  return <StorefrontCartContext.Provider value={value}>{children}</StorefrontCartContext.Provider>;
}

export function useStorefrontCart() {
  const context = useContext(StorefrontCartContext);
  if (!context) throw new Error("useStorefrontCart must be used inside StorefrontCartProvider");
  return context;
}
