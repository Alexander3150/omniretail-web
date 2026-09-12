"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataEventBus, useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontOrderTrackingDto } from "@/modules/storefront/application/dto/StorefrontOrderTrackingDto";
import { GetStorefrontOrderTrackingService } from "@/modules/storefront/application/services/GetStorefrontOrderTrackingService";
import { usePublicTenant } from "@/modules/storefront/providers/PublicTenantProvider";

export function useStorefrontOrderTracking(trackingToken: string) {
  const repositories = useRepositories();
  const eventBus = useDataEventBus();
  const { tenantId, loading: tenantLoading, error: tenantError } = usePublicTenant();
  const service = useMemo(
    () => new GetStorefrontOrderTrackingService(repositories),
    [repositories],
  );
  const [data, setData] = useState<StorefrontOrderTrackingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const orderIdRef = useRef<string | null>(null);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!tenantId) {
        if (active) {
          setData(null);
          orderIdRef.current = null;
          setError(tenantError ?? "No se pudo determinar la tienda pública.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const nextData = await service.execute(tenantId, trackingToken);
        if (!active) return;
        if (!nextData) {
          setData(null);
          orderIdRef.current = null;
          setError("No se encontró el pedido solicitado.");
          return;
        }
        orderIdRef.current = nextData.orderId;
        setData(nextData.tracking);
      } catch {
        if (active) setError("No se pudo cargar el pedido. Intenta nuevamente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    window.queueMicrotask(() => {
      if (active && !tenantLoading) void load();
    });

    const unsubscribe = eventBus.subscribe("order.changed", (event) => {
      if (
        active &&
        !tenantLoading &&
        event.tenantId === tenantId &&
        event.entityId === orderIdRef.current
      ) {
        void load();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [eventBus, reloadKey, service, tenantError, tenantId, tenantLoading, trackingToken]);

  return { data, loading: tenantLoading || loading, error, reload };
}
