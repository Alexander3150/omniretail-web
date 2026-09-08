"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { GetProductEditorDataService } from "@/modules/catalog/application/services/GetProductEditorDataService";
import { cleanError } from "@/modules/catalog/application/services/serviceHelpers";
import type { ProductEditorData } from "@/modules/catalog/application/dto/ProductEditorDto";

export function useProductEditorData(productId?: string) {
  const repositories = useRepositories();
  const service = useMemo(() => new GetProductEditorDataService(repositories), [repositories]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.execute(productId));
    } catch (caughtError) {
      setError(cleanError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [productId, service]);

  useEffect(() => {
    let active = true;
    service
      .execute(productId)
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError(null);
      })
      .catch((caughtError) => {
        if (active) setError(cleanError(caughtError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, service]);

  useDataEvent("product.changed", (payload) => {
    if (!productId || !payload.productId || payload.productId === productId) reload();
  });
  useDataEvent("unit-conversion.changed", (payload) => {
    if (!productId || !payload.productId || payload.productId === productId) reload();
  });
  useDataEvent("product-sales-price-tier.changed", (payload) => {
    if (!productId || !payload.productId || payload.productId === productId) reload();
  });
  useDataEvent("supplier-product.changed", (payload) => {
    if (!productId || !payload.productId || payload.productId === productId) reload();
  });
  useDataEvent("promotion.changed", reload);

  return { loading, data, error, reload };
}
