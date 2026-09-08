"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { GetProductEditorDataService } from "@/modules/catalog/application/services/GetProductEditorDataService";
import { cleanError } from "@/modules/catalog/application/services/serviceHelpers";
import type { ProductEditorData } from "@/modules/catalog/application/dto/ProductEditorDto";

export function useProductEditorData(productId?: string, branchId?: string) {
  const repositories = useRepositories();
  const service = useMemo(() => new GetProductEditorDataService(repositories), [repositories]);
  const requestIdRef = useRef(0);
  const requestKey = `${productId ?? ""}:${branchId ?? ""}`;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const nextData = await service.execute(productId, branchId);
      if (requestIdRef.current !== requestId) return;
      setData(nextData);
      setLoadedKey(requestKey);
    } catch (caughtError) {
      if (requestIdRef.current !== requestId) return;
      setData(null);
      setLoadedKey(requestKey);
      setError(cleanError(caughtError));
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [branchId, productId, requestKey, service]);

  useEffect(() => {
    let active = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    queueMicrotask(() => {
      if (!active || requestIdRef.current !== requestId) return;
      setLoading(true);
      setError(null);
    });
    service
      .execute(productId, branchId)
      .then((nextData) => {
        if (!active || requestIdRef.current !== requestId) return;
        setData(nextData);
        setLoadedKey(requestKey);
        setError(null);
      })
      .catch((caughtError) => {
        if (!active || requestIdRef.current !== requestId) return;
        setData(null);
        setLoadedKey(requestKey);
        setError(cleanError(caughtError));
      })
      .finally(() => {
        if (active && requestIdRef.current === requestId) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, productId, requestKey, service]);

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
  useDataEvent("inventory.changed", (payload) => {
    if (!branchId || !payload.branchId || payload.branchId === branchId) reload();
  });
  useDataEvent("promotion.changed", reload);

  const hasCurrentData = loadedKey === requestKey;

  return {
    loading: loading || !hasCurrentData,
    data: hasCurrentData && !loading ? data : null,
    error: hasCurrentData ? error : null,
    reload,
  };
}
