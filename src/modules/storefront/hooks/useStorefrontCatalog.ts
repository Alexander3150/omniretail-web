"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/core/entities";
import {
  useDataEventBus,
  useRepositories,
} from "@/infrastructure/providers/RepositoryProvider";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

export function useStorefrontCatalog() {
  const { products } = useRepositories();
  const eventBus = useDataEventBus();
  const { currentBranch, loading: branchLoading } = useActiveBranch();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const tenantId = currentBranch?.tenantId;

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!tenantId) {
        if (active) {
          setItems([]);
          setError("No se pudo determinar el negocio del catálogo.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const publishedProducts = await products.getPublishedForEcommerce(tenantId);
        if (active) setItems(publishedProducts);
      } catch {
        if (active) setError("No se pudo cargar el catálogo. Intenta nuevamente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    window.queueMicrotask(() => {
      if (active && !branchLoading) void load();
    });

    const unsubscribe = eventBus.subscribe("product.changed", (event) => {
      if (active && !branchLoading && event.tenantId === tenantId) void load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [branchLoading, eventBus, products, reloadKey, tenantId]);

  return {
    items,
    loading: branchLoading || loading,
    error,
    reload,
  };
}
