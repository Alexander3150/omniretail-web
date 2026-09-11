"use client";

import { useEffect, useMemo, useState } from "react";
import { SalesChannel } from "@/core/enums";
import { calculateEffectivePrice } from "@/core/pricing";
import { useDataEventBus, useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export interface StorefrontOfferItem {
  productId: string;
  name: string;
  sku: string;
  description?: string;
  basePrice: number;
  effectivePrice: number;
  discount: number;
  promotionName: string;
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
        if (active) { setItems([]); setError(tenantError ?? "La tienda pública no está disponible."); setLoading(false); }
        return;
      }
      setLoading(true); setError(null);
      try {
        const [products, promotions] = await Promise.all([
          repositories.products.getPublishedForEcommerce(tenantId),
          repositories.promotions.getActive(),
        ]);
        const now = new Date().toISOString();
        const offers = products.flatMap((product) => {
          const promotion = promotions.find((item) =>
            item.tenantId === tenantId && item.productIds.includes(product.id) && item.channels.includes(SalesChannel.ecommerce) && new Date(item.startAt).getTime() <= new Date(now).getTime() && (!item.endAt || new Date(now).getTime() <= new Date(item.endAt).getTime()),
          );
          if (!promotion) return [];
          const price = calculateEffectivePrice(product.salePrice, promotion);
          return [{ productId: product.id, name: product.name, sku: product.sku, description: product.description, basePrice: price.basePrice, effectivePrice: price.effectivePrice, discount: price.discountAmount, promotionName: promotion.name }];
        });
        if (active) setItems(offers);
      } catch { if (active) setError("No se pudieron cargar las ofertas."); }
      finally { if (active) setLoading(false); }
    };
    window.queueMicrotask(() => { if (active && !tenantLoading) void load(); });
    const unsubscribe = eventBus.subscribe("promotion.changed", (event) => { if (active && event.tenantId === tenantId) void load(); });
    return () => { active = false; unsubscribe(); };
  }, [eventBus, repositories, tenantError, tenantId, tenantLoading]);

  return useMemo(() => ({ items, loading: tenantLoading || loading, error }), [error, items, loading, tenantLoading]);
}