"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocationStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import type {
  AdjustStockDto,
  InventoryAlertsData,
  InventoryStatus,
  TransferRequestDto,
} from "@/modules/inventory/application/dto/InventoryAlertsDto";
import { AdjustInventoryStockService } from "@/modules/inventory/application/services/AdjustInventoryStockService";
import {
  GetInventoryAlertsService,
  isExpiringSoon,
} from "@/modules/inventory/application/services/GetInventoryAlertsService";

export type InventoryStatusFilter = InventoryStatus | "all";
export type InventoryKpiFilter = "all" | "active" | "lowStock" | "expiringSoon" | "outOfStock";

const EMPTY_DATA: InventoryAlertsData = {
  rows: [],
  alerts: [],
  transferRequests: [],
  kpis: { activeProducts: 0, lowStock: 0, expiringSoon: 0, outOfStock: 0 },
  visibility: {
    supportsExpiration: false,
    hasExpirationProducts: false,
    showExpirationFeatures: false,
  },
  branches: [],
  categories: [],
  locations: [],
};

export function useInventoryAlerts() {
  const repositories = useRepositories();
  const { currentBranch, branches: headerBranches, loading: branchLoading } = useActiveBranch();
  const getService = useMemo(() => new GetInventoryAlertsService(repositories), [repositories]);
  const adjustService = useMemo(() => new AdjustInventoryStockService(repositories), [repositories]);
  const [data, setData] = useState<InventoryAlertsData>(EMPTY_DATA);
  const [branchId, setBranchIdState] = useState("");
  const [search, setSearchState] = useState("");
  const [categoryId, setCategoryIdState] = useState("all");
  const [status, setStatusState] = useState<InventoryStatusFilter>("all");
  const [kpiFilter, setKpiFilterState] = useState<InventoryKpiFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loadedBranchId, setLoadedBranchId] = useState("");
  const effectiveBranchId = branchId || currentBranch?.id || "";

  const reload = useCallback(async () => {
    if (!effectiveBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const nextData = await getService.execute(effectiveBranchId);
      setData(nextData);
      setLoadedBranchId(effectiveBranchId);
      setLastUpdatedAt(new Date());
    } catch {
      setError("No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, getService]);

  useEffect(() => {
    let active = true;
    if (!effectiveBranchId) {
      return () => {
        active = false;
      };
    }
    getService
      .execute(effectiveBranchId)
      .then((nextData) => {
        if (!active) return;
        setData(nextData);
        setLoadedBranchId(effectiveBranchId);
        setLastUpdatedAt(new Date());
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el inventario.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveBranchId, getService]);

  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("inventory-transfer-request.changed", reload);
  useDataEvent("product.changed", reload);
  useDataEvent("category.changed", reload);
  useDataEvent("business-config.changed", reload);

  const effectiveKpiFilter: InventoryKpiFilter =
    !data.visibility.showExpirationFeatures && kpiFilter === "expiringSoon" ? "all" : kpiFilter;
  const baseFilteredRows = useMemo(
    () => filterRows(data.rows, search, categoryId, status, "all"),
    [categoryId, data.rows, search, status],
  );
  const filteredRows = useMemo(
    () => filterRows(baseFilteredRows, "", "all", "all", effectiveKpiFilter),
    [baseFilteredRows, effectiveKpiFilter],
  );
  const filteredKpis = useMemo(
    () => ({
      activeProducts: baseFilteredRows.length,
      lowStock: baseFilteredRows.filter(
        (row) => row.status === "critical" || row.status === "near_minimum",
      ).length,
      expiringSoon: data.visibility.showExpirationFeatures
        ? baseFilteredRows.filter(
            (row) => row.tracksExpiration && isExpiringSoon(row.nextExpirationDate),
          ).length
        : 0,
      outOfStock: baseFilteredRows.filter((row) => row.status === "out_of_stock").length,
    }),
    [baseFilteredRows, data.visibility.showExpirationFeatures],
  );
  const activeBranch = data.branches.find((branch) => branch.id === effectiveBranchId) ?? currentBranch;
  const activeLocations = data.locations.filter(
    (location) => location.status === LocationStatus.active,
  );

  const setBranchId = useCallback((value: string) => {
    setLoading(true);
    setBranchIdState(value);
    setSearchState("");
    setCategoryIdState("all");
    setStatusState("all");
    setKpiFilterState("all");
  }, []);

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const setCategoryId = useCallback((value: string) => setCategoryIdState(value), []);
  const setStatus = useCallback((value: InventoryStatusFilter) => setStatusState(value), []);
  const setKpiFilter = useCallback((value: InventoryKpiFilter) => {
    setKpiFilterState(value);
    if (value === "lowStock") {
      setStatusState((current) =>
        current === "critical" || current === "near_minimum" || current === "all"
          ? current
          : "all",
      );
    }
    if (value === "outOfStock") setStatusState("out_of_stock");
    if (value === "active") setStatusState("all");
  }, []);

  async function adjustStock(dto: AdjustStockDto) {
    setBusy(true);
    setError(null);
    try {
      await adjustService.execute(dto);
      await reload();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "No se pudo registrar el ajuste.";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function requestTransfer(dto: TransferRequestDto) {
    setBusy(true);
    setError(null);
    try {
      if (!activeBranch) throw new Error("Selecciona una sucursal activa.");
      await repositories.inventoryTransferRequests.createRequest({
        tenantId: activeBranch.tenantId,
        requestingBranchId: dto.requesterBranchId,
        sourceBranchId: dto.providerBranchId,
        productId: dto.productId,
        requestedQuantity: dto.quantity,
        reason: dto.reason,
        notes: dto.notes.trim() || undefined,
      });
      await reload();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo crear la solicitud.";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function approveTransferRequest(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      await repositories.inventoryTransferRequests.approveRequest(requestId);
      await reload();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo aprobar la solicitud.";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function rejectTransferRequest(requestId: string, rejectionReason: string) {
    setBusy(true);
    setError(null);
    try {
      await repositories.inventoryTransferRequests.rejectRequest(requestId, rejectionReason);
      await reload();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No se pudo rechazar la solicitud.";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  return {
    data,
    kpis: filteredKpis,
    rows: filteredRows,
    branchId: effectiveBranchId,
    activeBranch,
    branches: data.branches.length ? data.branches : headerBranches,
    categories: data.categories,
    locations: activeLocations,
    search,
    categoryId,
    status,
    kpiFilter: effectiveKpiFilter,
    filtersOpen,
    loading: branchLoading || loading || (Boolean(effectiveBranchId) && loadedBranchId !== effectiveBranchId),
    busy,
    error,
    lastUpdatedAt,
    setBranchId,
    setSearch,
    setCategoryId,
    setStatus,
    setKpiFilter,
    setFiltersOpen,
    reload,
    adjustStock,
    requestTransfer,
    approveTransferRequest,
    rejectTransferRequest,
  };
}

function filterRows(
  rows: InventoryAlertsData["rows"],
  search: string,
  categoryId: string,
  status: InventoryStatusFilter,
  kpiFilter: InventoryKpiFilter,
) {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesSearch =
      !query ||
      [row.productName, row.sku, row.categoryName, row.defaultLocationName]
        .some((value) => value.toLowerCase().includes(query));
    const matchesCategory = categoryId === "all" || row.categoryId === categoryId;
    const matchesStatus = status === "all" || row.status === status;
    const matchesKpi =
      kpiFilter === "all" ||
      kpiFilter === "active" ||
      (kpiFilter === "lowStock" &&
        (row.status === "critical" || row.status === "near_minimum")) ||
      (kpiFilter === "expiringSoon" &&
        row.tracksExpiration &&
        isExpiringSoon(row.nextExpirationDate)) ||
      (kpiFilter === "outOfStock" && row.status === "out_of_stock");
    return matchesSearch && matchesCategory && matchesStatus && matchesKpi;
  });
}
