"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/core/entities";
import {
  useDataEventBus,
  useRepositories,
} from "@/infrastructure/providers/RepositoryProvider";

export function useStorefrontCatalog() {
  const { products } = useRepositories();
  const eventBus = useDataEventBus();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const publishedProducts = await products.getPublishedForEcommerce();

    setItems(publishedProducts);
    setLoading(false);
  }, [products]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    const unsubscribe = eventBus.subscribe("product.changed", () => {
      void load();
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [eventBus, load]);

  return {
    items,
    loading,
    reload: load,
  };
}