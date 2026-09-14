"use client";

import { useCallback, useEffect, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import {
  toCustomerOrderSummaryDto,
  type CustomerOrderSummaryDto,
} from "@/modules/customer/application/dto/CustomerOrderSummaryDto";
import { useCustomerIdentity } from "@/modules/customer/hooks/useCustomerIdentity";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

/**
 * Solo lectura, tal como quedo definido en el alcance de este PR:
 * cualquier accion sobre un pedido (cancelar, ver detalle completo,
 * reordenar) es responsabilidad del modulo storefront (Maria/Riquelme),
 * no de este.
 *
 * Sin parametros: la identidad (tenantId/customerId) se resuelve
 * internamente via useCustomerIdentity, nunca desde la pantalla --
 * repositories.orders.getByCustomer exige ambos, asi que conocer el
 * customerId de otro cliente no alcanza para ver sus pedidos.
 */
export function useCustomerOrders() {
  const repositories = useRepositories();
  const { tenantId, customerId, loading: identityLoading, error: identityError } =
    useCustomerIdentity();
  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (identityLoading) return;
    if (!tenantId || !customerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.orders.getByCustomer(tenantId, customerId);
      setOrders(
        [...items]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toCustomerOrderSummaryDto),
      );
      setError(null);
    } catch (caughtError) {
      setOrders([]);
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, [customerId, identityLoading, repositories, tenantId]);

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

  useDataEvent("order.changed", reload);

  return { orders, loading: loading || identityLoading, error: error ?? identityError, reload };
}
