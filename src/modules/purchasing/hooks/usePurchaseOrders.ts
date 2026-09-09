"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PurchaseOrderStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { GetPurchaseOrdersReadModelService } from "@/modules/purchasing/application/services/GetPurchaseOrdersReadModelService";
import type {
  PurchaseOrderRowReadModel,
  PurchaseOrderStatusFilter,
  PurchaseOrdersReadModel,
} from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

interface PurchaseOrderFilters {
  search: string;
  status: PurchaseOrderStatusFilter;
  supplierId: string;
}

const DEFAULT_FILTERS: PurchaseOrderFilters = {
  search: "",
  status: "all",
  supplierId: "all",
};

const EMPTY_DATA: PurchaseOrdersReadModel = {
  orders: [],
  suppliers: [],
  statuses: [],
  suggestions: [],
};

export function usePurchaseOrders() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const service = useMemo(() => new GetPurchaseOrdersReadModelService(repositories), [repositories]);
  const [data, setData] = useState<PurchaseOrdersReadModel>(EMPTY_DATA);
  const [filters, setFilters] = useState<PurchaseOrderFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await service.execute(activeBranchId);
      setData(nextData);
    } catch {
      setError("No se pudieron cargar las ordenes de compra.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, service]);

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

  useDataEvent("purchase-order.changed", reload);
  useDataEvent("receipt.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("supplier.changed", reload);
  useDataEvent("supplier-product.changed", reload);
  useDataEvent("product.changed", reload);

  const filteredOrders = useMemo(() => filterOrders(data.orders, filters), [data.orders, filters]);
  const updateFilters = useCallback((patch: Partial<PurchaseOrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);
  const updateStatus = useCallback(
    async (orderId: string, status: PurchaseOrderStatus) => {
      await repositories.purchaseOrders.updateStatus(orderId, status);
    },
    [repositories],
  );

  return {
    data,
    filters,
    filteredOrders,
    loading: branchLoading || loading,
    error,
    updateFilters,
    updateStatus,
  };
}

function filterOrders(orders: PurchaseOrderRowReadModel[], filters: PurchaseOrderFilters) {
  const search = normalize(filters.search);
  return orders.filter((order) => {
    const matchesSearch = !search || order.searchText.includes(search);
    const matchesStatus = filters.status === "all" || order.status === filters.status;
    const matchesSupplier = filters.supplierId === "all" || order.supplierId === filters.supplierId;
    return matchesSearch && matchesStatus && matchesSupplier;
  });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
