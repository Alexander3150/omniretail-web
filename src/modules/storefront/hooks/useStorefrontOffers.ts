"use client";

import { useEffect, useMemo, useState } from "react";
import type { Promotion } from "@/core/entities";
import { BranchStatus, PromotionStatus, SalesChannel } from "@/core/enums";
import { calculateEffectivePrice } from "@/core/pricing";
import { isBranchScopedResourceAvailable } from "@/core/scopes/branchScope";
import { useDataEventBus, useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export interface StorefrontOfferItem {
  productId: string;
  name: string;
  sku: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  basePrice: number;
  effectivePrice: number;
  discount: number;
  promotionName: string;
}

function isApplicableEcommercePromotion(
  promotion: Promotion,
  tenantId: string,
  productId: string,
  ecommerceBranchId: string,
  now: Date,
): boolean {
  const startsAt = new Date(promotion.startAt).getTime();
  const endsAt = promotion.endAt ? new Date(promotion.endAt).getTime() : Number.POSITIVE_INFINITY;
  return (
    promotion.tenantId === tenantId &&
    promotion.status === PromotionStatus.active &&
    promotion.channels.includes(SalesChannel.ecommerce) &&
    promotion.productIds.includes(productId) &&
    isBranchScopedResourceAvailable(promotion.branchIds, ecommerceBranchId) &&
    startsAt <= now.getTime() &&
    now.getTime() <= endsAt
  );
}

function selectPromotion(promotions: Promotion[], basePrice: number): Promotion | undefined {
  return promotions.reduce<Promotion | undefined>((selected, candidate) => {
    if (!selected) return candidate;
    const selectedPrice = calculateEffectivePrice(basePrice, selected).effectivePrice;
    const candidatePrice = calculateEffectivePrice(basePrice, candidate).effectivePrice;
    // Entre promociones ya válidas para la misma sucursal, gana el menor precio final.
    // El ID resuelve empates para no depender del orden del arreglo.
    if (candidatePrice < selectedPrice) return candidate;
    if (candidatePrice === selectedPrice && candidate.id.localeCompare(selected.id) < 0)
      return candidate;
    return selected;
  }, undefined);
}

export function useStorefrontOffers() {
  const repositories = useRepositories();
  const eventBus = useDataEventBus();
  const { tenantId, loading: tenantLoading, error: tenantError } = usePublicTenant();
  const [items, setItems] = useState<StorefrontOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!tenantId) {
        if (active) {
          setItems([]);
          setError(tenantError ?? "La tienda pública no está disponible.");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const ecommerceConfig = await repositories.businessConfig.getEcommerceConfig(tenantId);
        if (!ecommerceConfig?.enabled || !ecommerceConfig.defaultBranchId)
          throw new Error("E-commerce branch is not configured");

        const ecommerceBranchId = ecommerceConfig.defaultBranchId;
        const [ecommerceBranch, products, promotions] = await Promise.all([
          repositories.branches.getById(ecommerceBranchId),
          repositories.products.getPublishedForEcommerce(tenantId),
          repositories.promotions.getActive(),
        ]);
        if (
          !ecommerceBranch ||
          ecommerceBranch.tenantId !== tenantId ||
          ecommerceBranch.status !== BranchStatus.active
        ) {
          throw new Error("E-commerce branch is not available");
        }
        const now = new Date();
        const offers = (
          await Promise.all(
            products.map(async (product) => {
              const promotion = selectPromotion(
                promotions.filter((item) =>
                  isApplicableEcommercePromotion(
                    item,
                    tenantId,
                    product.id,
                    ecommerceBranchId,
                    now,
                  ),
                ),
                product.salePrice,
              );
              if (!promotion) return null;
              const [media, price] = await Promise.all([
                repositories.productMedia.getPrimaryByProduct(product.id),
                Promise.resolve(calculateEffectivePrice(product.salePrice, promotion)),
              ]);
              return {
                productId: product.id,
                name: product.name,
                sku: product.sku,
                description: product.description,
                imageUrl:
                  media?.tenantId === tenantId && media.type === "image" ? media.url : undefined,
                imageAlt: media?.tenantId === tenantId ? media.alt : undefined,
                basePrice: price.basePrice,
                effectivePrice: price.effectivePrice,
                discount: price.discountAmount,
                promotionName: promotion.name,
              };
            }),
          )
        ).filter((item) => item !== null) as StorefrontOfferItem[];
        if (active) setItems(offers);
      } catch {
        if (active) setError("No se pudieron cargar las ofertas.");
      } finally {
        if (active) setLoading(false);
      }
    };
    window.queueMicrotask(() => {
      if (active && !tenantLoading) void load();
    });
    const unsubscribe = eventBus.subscribe("promotion.changed", (event) => {
      if (active && event.tenantId === tenantId) void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [eventBus, repositories, tenantError, tenantId, tenantLoading]);

  return useMemo(
    () => ({ items, loading: tenantLoading || loading, error }),
    [error, items, loading, tenantLoading],
  );
}
