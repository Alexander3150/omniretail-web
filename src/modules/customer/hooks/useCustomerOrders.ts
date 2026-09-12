"use client";

import { useCallback, useEffect, useState } from "react";
import type { Order } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

/**
 * Solo lectura, tal como quedo definido en el alcance de este PR:
 * cualquier accion sobre un pedido (cancelar, ver detalle completo,
 * reordenar) es responsabilidad del modulo storefront (Maria/Riquelme),
 * no de este.
 */
export function useCustomerOrders(customerId: string | undefined) {
  const repositories = useRepositories();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!customerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await repositories.orders.getByCustomer(customerId);
      setOrders([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setError(null);
    } catch (caughtError) {
      setOrders([]);
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, [customerId, repositories]);

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

  return { orders, loading, error, reload };
}
