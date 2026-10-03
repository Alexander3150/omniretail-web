"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaasCapabilityKey, type PurchaseOrderStatus } from "@/core/enums";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  PurchaseOrderAction,
  PurchaseOrderRowReadModel,
  PurchaseOrderStatusFilter,
  PurchaseOrdersReadModel,
} from "@/modules/purchasing/application/dto/PurchaseOrderReadModel";
import {
  GetPurchaseOrdersReadModelService,
  type GetPurchaseOrdersParams,
} from "@/modules/purchasing/application/services/GetPurchaseOrdersReadModelService";
import { UpdatePurchaseOrderStatusService } from "@/modules/purchasing/application/services/UpdatePurchaseOrderStatusService";
import type { TablePageSize } from "@/shared/components/TablePagination";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useEntitlement } from "@/shared/hooks/useEntitlement";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

const DEFAULT_PAGE_SIZE: TablePageSize = 10;

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
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
};

export function usePurchaseOrders() {
  const repositories = useRepositories();
  const { hasCapability } = useEntitlement();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const activeBranchName = currentBranch?.name;
  const apiMode = repositories.purchaseOrdersDataSource === "api";
  const service = useMemo(
    () => new GetPurchaseOrdersReadModelService(repositories),
    [repositories],
  );
  const updateStatusService = useMemo(
    () => new UpdatePurchaseOrderStatusService(repositories),
    [repositories],
  );
  const requestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const [data, setData] = useState<PurchaseOrdersReadModel>(EMPTY_DATA);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrderRowReadModel | null>(null);
  const [filters, setFilters] = useState<PurchaseOrderFilters>(DEFAULT_FILTERS);
  const filtersRef = useRef(DEFAULT_FILTERS);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<TablePageSize>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = filters.status;
  const supplierFilter = filters.supplierId;
  const requestInput = useMemo<string | GetPurchaseOrdersParams>(
    () =>
      apiMode
        ? {
            branchId: activeBranchId,
            branchName: activeBranchName,
            supplierId: supplierFilter === "all" ? undefined : supplierFilter,
            status: statusFilter === "all" ? undefined : statusFilter,
            page,
            pageSize,
          }
        : (activeBranchId ?? ""),
    [
      activeBranchId,
      activeBranchName,
      apiMode,
      page,
      pageSize,
      statusFilter,
      supplierFilter,
    ],
  );

  const applyResult = useCallback(
    (nextData: PurchaseOrdersReadModel, requestId: number) => {
      if (requestIdRef.current !== requestId) return;
      if (apiMode && nextData.totalPages > 0 && nextData.page > nextData.totalPages) {
        setPageState(nextData.totalPages);
        return;
      }
      setData(nextData);
      if (apiMode) {
        setPageState(nextData.page);
      }
      setError(null);
    },
    [apiMode],
  );

  const reload = useCallback(async () => {
    if (branchLoading) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      applyResult(await service.execute(requestInput), requestId);
    } catch (caughtError) {
      if (requestIdRef.current === requestId) setError(toLoadErrorMessage(caughtError));
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [applyResult, branchLoading, requestInput, service]);

  useEffect(() => {
    if (branchLoading) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void service
      .execute(requestInput)
      .then((nextData) => applyResult(nextData, requestId))
      .catch((caughtError: unknown) => {
        if (requestIdRef.current === requestId) setError(toLoadErrorMessage(caughtError));
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [applyResult, branchLoading, requestInput, service]);

  useDataEvent("purchase-order.changed", reload);
  useDataEvent("receipt.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("supplier.changed", reload);
  useDataEvent("supplier-product.changed", reload);
  useDataEvent("product.changed", reload);

  const canUsePurchasing = hasCapability(SaasCapabilityKey.purchasing);
  const gatedData = useMemo<PurchaseOrdersReadModel>(
    () => ({ ...data, orders: applyCapabilityGating(data.orders, canUsePurchasing) }),
    [data, canUsePurchasing],
  );
  const gatedDetailOrder = useMemo(
    () =>
      detailOrder
        ? (applyCapabilityGating([detailOrder], canUsePurchasing)[0] ?? detailOrder)
        : null,
    [canUsePurchasing, detailOrder],
  );
  const filteredOrders = useMemo(
    () => (apiMode ? gatedData.orders : filterOrders(gatedData.orders, filters)),
    [apiMode, gatedData.orders, filters],
  );
  const paginatedOrders = useMemo(
    () =>
      apiMode
        ? filteredOrders
        : filteredOrders.slice((page - 1) * pageSize, page * pageSize),
    [apiMode, filteredOrders, page, pageSize],
  );
  const totalItems = apiMode ? gatedData.totalItems : filteredOrders.length;
  const totalPages = apiMode
    ? gatedData.totalPages
    : Math.ceil(filteredOrders.length / pageSize);

  const updateFilters = useCallback(
    (patch: Partial<PurchaseOrderFilters>) => {
      const current = filtersRef.current;
      const next = { ...current, ...patch };
      if (areFiltersEqual(current, next)) return;
      filtersRef.current = next;
      setFilters(next);
      if (
        apiMode &&
        (current.status !== next.status || current.supplierId !== next.supplierId)
      ) {
        setLoading(true);
        setError(null);
      }
      setPageState(1);
    },
    [apiMode],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return;
      if (apiMode) {
        setLoading(true);
        setError(null);
      }
      setPageState(nextPage);
    },
    [apiMode, page],
  );

  const setPageSize = useCallback(
    (nextPageSize: TablePageSize) => {
      if (nextPageSize === pageSize) return;
      if (apiMode) {
        setLoading(true);
        setError(null);
      }
      setPageSizeState(nextPageSize);
      setPageState(1);
    },
    [apiMode, pageSize],
  );

  const loadOrderById = useCallback(
    async (orderId: string) => {
      if (!apiMode) return null;
      const loadedOrder = gatedData.orders.find((order) => order.id === orderId);
      if (loadedOrder) return loadedOrder;
      const requestId = detailRequestIdRef.current + 1;
      detailRequestIdRef.current = requestId;
      try {
        const order = await service.getById(orderId, {
          id: activeBranchId,
          name: activeBranchName,
        });
        if (detailRequestIdRef.current !== requestId) return null;
        const gatedOrder = order
          ? (applyCapabilityGating([order], canUsePurchasing)[0] ?? order)
          : null;
        setDetailOrder(order);
        return gatedOrder;
      } catch (caughtError) {
        if (detailRequestIdRef.current === requestId) setError(toLoadErrorMessage(caughtError));
        return null;
      }
    },
    [activeBranchId, activeBranchName, apiMode, canUsePurchasing, gatedData.orders, service],
  );

  const updateStatus = useCallback(
    async (orderId: string, status: PurchaseOrderStatus, cancellationReason?: string) => {
      if (mutationInFlightRef.current) {
        throw new Error("Ya hay una actualizacion de orden en curso.");
      }
      mutationInFlightRef.current = true;
      setMutationPending(true);
      try {
        return await updateStatusService.execute(orderId, status, cancellationReason);
      } finally {
        mutationInFlightRef.current = false;
        setMutationPending(false);
      }
    },
    [updateStatusService],
  );

  return {
    apiMode,
    data: gatedData,
    detailOrder: gatedDetailOrder,
    filters,
    filteredOrders,
    paginatedOrders,
    totalItems,
    totalPages,
    page,
    pageSize,
    currentBranch,
    loading: branchLoading || loading,
    error,
    mutationPending,
    updateFilters,
    setPage,
    setPageSize,
    loadOrderById,
    updateStatus,
  };
}

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

function areFiltersEqual(left: PurchaseOrderFilters, right: PurchaseOrderFilters) {
  return (
    left.search === right.search &&
    left.status === right.status &&
    left.supplierId === right.supplierId
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toLoadErrorMessage(error: unknown) {
  if (error instanceof BackendRequestError || error instanceof Error) return error.message;
  return "No se pudieron cargar las ordenes de compra.";
}
