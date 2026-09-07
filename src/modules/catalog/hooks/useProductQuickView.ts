"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { GetProductQuickViewService } from "@/modules/catalog/application/services/GetProductQuickViewService";
import type { ProductQuickViewModel } from "@/modules/catalog/types/catalog.types";

export function useProductQuickView(productId: string | null) {
  const repositories = useRepositories();
  const service = useMemo(() => new GetProductQuickViewService(repositories), [repositories]);
  const [data, setData] = useState<ProductQuickViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!productId) {
      return;
    }
    setError(null);
    try {
      setData(await service.execute(productId));
    } catch {
      setError("No se pudo cargar la consulta rápida.");
    }
  }, [productId, service]);

  useEffect(() => {
    if (!productId) return;

    let active = true;
    service
      .execute(productId)
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar la consulta rápida.");
      });

    return () => {
      active = false;
    };
  }, [productId, service]);

  useDataEvent("product.changed", (payload) => {
    if (productId && (!payload.productId || payload.productId === productId)) reload();
  });
  useDataEvent("stock.changed", (payload) => {
    if (productId && (!payload.productId || payload.productId === productId)) reload();
  });
  useDataEvent("supplier.changed", reload);
  useDataEvent("promotion.changed", reload);

  const currentData = data?.product.id === productId ? data : null;
  const loading = Boolean(productId && !currentData && !error);

  return { loading, data: currentData, error, reload };
}
