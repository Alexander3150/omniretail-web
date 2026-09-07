"use client";

import { useCallback, useEffect, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import {
  cleanError,
  requireCapabilities,
  resolveTenantId,
} from "@/modules/catalog/application/services/serviceHelpers";
import type { ProductFormOptions } from "@/modules/catalog/types/catalog.types";

export function useProductFormOptions() {
  const repositories = useRepositories();
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<ProductFormOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categories, units, tenantId] = await Promise.all([
        repositories.categories.getActive(),
        repositories.units.getActive(),
        resolveTenantId(repositories),
      ]);
      if (!tenantId) throw new Error("No tenant");
      const businessCapabilities = await requireCapabilities(repositories, tenantId);
      setOptions({ categories, units, businessCapabilities });
    } catch (caughtError) {
      setError(cleanError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [repositories]);

  useEffect(() => {
    let active = true;
    Promise.all([
      repositories.categories.getActive(),
      repositories.units.getActive(),
      resolveTenantId(repositories),
    ])
      .then(async ([categories, units, tenantId]) => {
        if (!tenantId) throw new Error("No tenant");
        const businessCapabilities = await requireCapabilities(repositories, tenantId);
        if (active) {
          setOptions({ categories, units, businessCapabilities });
          setError(null);
        }
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
  }, [repositories]);

  useDataEvent("category.changed", reload);
  useDataEvent("business-config.changed", reload);

  return { loading, options, error, reload };
}
