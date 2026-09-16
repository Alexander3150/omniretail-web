"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SaasCapabilityKey, type PurchaseOrderStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { GetPurchaseOrdersReadModelService } from "@/modules/purchasing/application/services/GetPurchaseOrdersReadModelService";
import { UpdatePurchaseOrderStatusService } from "@/modules/purchasing/application/services/UpdatePurchaseOrderStatusService";
import type {
  PurchaseOrderAction,
  PurchaseOrderRowReadModel,
  PurchaseOrderStatusFilter,
  PurchaseOrdersReadModel,
} from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useEntitlement } from "@/shared/hooks/useEntitlement";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

// UI action gating (feature/saas-entitlement-enforcement §7/§9): acciones mutables de una orden --
// las de solo lectura/navegacion (continuar recepcion, descargar PDF) NUNCA se gatean por
// capability, solo por el permission gating ya resuelto en getPurchaseOrderActions.
const MUTATION_ACTION_IDS: ReadonlySet<PurchaseOrderAction["id"]> = new Set([
  "edit-draft",
  "send-approval",
  "approve",
  "cancel",
]);

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
  const { hasCapability } = useEntitlement();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const service = useMemo(
    () => new GetPurchaseOrdersReadModelService(repositories),
    [repositories],
  );
  const updateStatusService = useMemo(
    () => new UpdatePurchaseOrderStatusService(repositories),
    [repositories],
  );
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

  // Gating reactivo (no en `reload`): `canUsePurchasing` puede resolverse despues del primer
  // render (EntitlementProvider carga async) -- recalcular aca evita quedar con botones
  // deshabilitados "pegados" si `reload` no vuelve a dispararse.
  const canUsePurchasing = hasCapability(SaasCapabilityKey.purchasing);
  const gatedData = useMemo<PurchaseOrdersReadModel>(
    () => ({ ...data, orders: applyCapabilityGating(data.orders, canUsePurchasing) }),
    [data, canUsePurchasing],
  );
  const filteredOrders = useMemo(
    () => filterOrders(gatedData.orders, filters),
    [gatedData.orders, filters],
  );
  const updateFilters = useCallback((patch: Partial<PurchaseOrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);
  const updateStatus = useCallback(
    async (orderId: string, status: PurchaseOrderStatus) => {
      await updateStatusService.execute(orderId, status);
    },
    [updateStatusService],
  );

  return {
    data: gatedData,
    filters,
    filteredOrders,
    currentBranch,
    loading: branchLoading || loading,
    error,
    updateFilters,
    updateStatus,
  };
}

// UI action gating (feature/saas-entitlement-enforcement §7/§9): capa PURAMENTE de UI sobre las
// acciones ya resueltas por `getPurchaseOrderActions` (permission+status) -- nunca sustituye el
// guard real (`UpdatePurchaseOrderStatusService`/`PurchaseOrderEditorService` siguen siendo la
// autoridad final). Historico read-only (continuar recepcion, descargar PDF) queda intacto.
function applyCapabilityGating(
  orders: PurchaseOrderRowReadModel[],
  canUsePurchasing: boolean,
): PurchaseOrderRowReadModel[] {
  if (canUsePurchasing) return orders;
  return orders.map((order) => ({
    ...order,
    actions: order.actions.map((action) =>
      MUTATION_ACTION_IDS.has(action.id) && action.enabled
        ? {
            ...action,
            enabled: false,
            unavailableReason: "Tu plan actual no incluye compras.",
          }
        : action,
    ),
  }));
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
