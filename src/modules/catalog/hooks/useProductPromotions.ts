"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Promotion } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { FinalizeProductPromotionService } from "@/modules/catalog/application/services/FinalizeProductPromotionService";
import { GetProductPromotionsService } from "@/modules/catalog/application/services/GetProductPromotionsService";
import {
  SaveProductPromotionService,
  type SaveProductPromotionInput,
} from "@/modules/catalog/application/services/SaveProductPromotionService";
import type { ProductPromotionsViewModel } from "@/modules/catalog/application/services/GetProductPromotionsService";

export function useProductPromotions(productId: string | null) {
  const repositories = useRepositories();
  const getService = useMemo(() => new GetProductPromotionsService(repositories), [repositories]);
  const saveService = useMemo(() => new SaveProductPromotionService(repositories), [repositories]);
  const finalizeService = useMemo(
    () => new FinalizeProductPromotionService(repositories),
    [repositories],
  );
  const [data, setData] = useState<ProductPromotionsViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!productId) return;
    setError(null);
    try {
      setData(await getService.execute(productId));
    } catch {
      setError("No se pudieron cargar las promociones.");
    }
  }, [getService, productId]);

  useEffect(() => {
    let active = true;
    if (!productId) return;

    getService
      .execute(productId)
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar las promociones.");
      });

    return () => {
      active = false;
    };
  }, [getService, productId]);

  useDataEvent("promotion.changed", (payload) => {
    if (productId && (!payload.productId || payload.productId === productId)) reload();
  });

  const save = useCallback(
    async (input: SaveProductPromotionInput): Promise<Promotion> => {
      const promotion = await saveService.execute(input);
      await reload();
      return promotion;
    },
    [reload, saveService],
  );

  const finalize = useCallback(
    async (promotionId: string): Promise<Promotion> => {
      const promotion = await finalizeService.execute(promotionId);
      await reload();
      return promotion;
    },
    [finalizeService, reload],
  );

  const currentData = data?.product.id === productId ? data : null;
  const loading = Boolean(productId && !currentData && !error);

  return { data: currentData, error, loading, save, finalize };
}
