"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { TenantSubscriptionDetailsDto } from "@/modules/administration/application/dto/SubscriptionDto";
import { GetTenantSubscriptionDetailsService } from "@/modules/administration/application/services/GetTenantSubscriptionDetailsService";
import { cleanError } from "@/modules/administration/application/services/serviceHelpers";
import { PLANS_READ_PERMISSION } from "@/modules/administration/permissions";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

/**
 * Lee el read model único (GetTenantSubscriptionDetailsService) -- nunca recalcula entitlements/
 * usage acá. Se recarga en user.changed/branch.changed porque son los dos eventos que cambian
 * los contadores de uso (altas/bajas de empleados o sucursales); no hay ninguna mutación de
 * Plan/Subscription en este PR que necesite su propio evento todavía.
 */
export function useTenantSubscription() {
  const repositories = useRepositories();
  const { user, permissions, hasPermission, loading: sessionLoading } = useCurrentSession();
  const tenantId = user?.tenantId ?? null;
  const canRead = hasPermission(PLANS_READ_PERMISSION);
  const service = useMemo(
    () => new GetTenantSubscriptionDetailsService(repositories),
    [repositories],
  );

  const [details, setDetails] = useState<TenantSubscriptionDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (sessionLoading) return;
    if (!tenantId) {
      setDetails(null);
      setError("No se pudo resolver el negocio activo.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await service.execute(tenantId, permissions);
      setDetails(result);
    } catch (caughtError) {
      setDetails(null);
      setError(cleanError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [permissions, service, sessionLoading, tenantId]);

  useDataEvent("user.changed", reload);
  useDataEvent("branch.changed", reload);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  return {
    loading: loading || sessionLoading,
    error,
    details,
    canRead,
    reload,
  };
}
