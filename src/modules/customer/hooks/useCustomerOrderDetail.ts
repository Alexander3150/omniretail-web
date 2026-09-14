"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerOrderDetailDto } from "@/modules/customer/application/dto/CustomerOrderDetailDto";
import { getCurrentCustomerOrderDetail } from "@/modules/customer/application/services/orderService";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";

export function useCustomerOrderDetail(orderId: string) {
  const repositories = useRepositories();
  const [order, setOrder] = useState<CustomerOrderDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const nextOrder = await getCurrentCustomerOrderDetail(repositories, orderId);
      setOrder(nextOrder);
      setError(null);
    } catch (cause) {
      setOrder(null);
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el pedido.");
    } finally {
      setLoading(false);
    }
  }, [orderId, repositories]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { order, loading, error, reload };
}
