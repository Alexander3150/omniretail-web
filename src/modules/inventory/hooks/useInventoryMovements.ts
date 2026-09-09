import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import type {
  InventoryMovementKpis,
  InventoryMovementRow,
  InventoryMovementsData,
  MovementPeriodFilter,
  MovementTypeFilter,
} from "@/modules/inventory/application/dto/InventoryMovementsDto";
import { GetInventoryMovementsService } from "@/modules/inventory/application/services/GetInventoryMovementsService";

const EMPTY_DATA: InventoryMovementsData = {
  rows: [],
  branches: [],
};

export const MOVEMENT_PERIOD_OPTIONS: Array<{ value: MovementPeriodFilter; label: string }> = [
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "90d", label: "Ultimos 90 dias" },
  { value: "all", label: "Todos" },
];

export function useInventoryMovements() {
  const searchParams = useSearchParams();
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const service = useMemo(() => new GetInventoryMovementsService(repositories), [repositories]);
  const [data, setData] = useState<InventoryMovementsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchState] = useState("");
  const [period, setPeriodState] = useState<MovementPeriodFilter>("30d");
  const [type, setTypeState] = useState<MovementTypeFilter>("all");
  const [branchId, setBranchIdState] = useState(() => searchParams.get("branchId") ?? "all");
  const [productId, setProductIdState] = useState(() => searchParams.get("productId") ?? "");
  const [filtersOpen, setFiltersOpenState] = useState(
    () => Boolean(searchParams.get("branchId") || searchParams.get("productId")),
  );
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const resetPage = useCallback(() => setPageState(1), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await service.execute(activeBranchId);
      setData(nextData);
    } catch {
      setError("No se pudo cargar el historial de movimientos.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, service]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      service
        .execute(activeBranchId)
        .then((nextData) => {
          if (!active) return;
          setData(nextData);
        })
        .catch(() => {
          if (active) setError("No se pudo cargar el historial de movimientos.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [activeBranchId, service]);

  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("product.changed", reload);
  useDataEvent("branch.changed", reload);
  useDataEvent("inventory-transfer.changed", reload);

  const filteredRows = useMemo(
    () => filterRows(data.rows, { search, period, type, branchId, productId }),
    [branchId, data.rows, period, productId, search, type],
  );
  const kpis = useMemo<InventoryMovementKpis>(() => {
    const incoming = filteredRows
      .filter((row) => row.signedQuantity > 0)
      .reduce((total, row) => total + row.signedQuantity, 0);
    const outgoing = filteredRows
      .filter((row) => row.signedQuantity < 0)
      .reduce((total, row) => total + Math.abs(row.signedQuantity), 0);
    return { incoming, outgoing, net: incoming - outgoing };
  }, [filteredRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const setPage = useCallback((value: number) => setPageState(value), []);
  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      resetPage();
    },
    [resetPage],
  );
  const setPeriod = useCallback(
    (value: MovementPeriodFilter) => {
      setPeriodState(value);
      resetPage();
    },
    [resetPage],
  );
  const setType = useCallback(
    (value: MovementTypeFilter) => {
      setTypeState(value);
      resetPage();
    },
    [resetPage],
  );
  const setBranchId = useCallback(
    (value: string) => {
      setBranchIdState(value);
      resetPage();
    },
    [resetPage],
  );
  const setProductId = useCallback(
    (value: string) => {
      setProductIdState(value);
      resetPage();
    },
    [resetPage],
  );
  const setPageSize = useCallback(
    (value: number) => {
      setPageSizeState(value);
      resetPage();
    },
    [resetPage],
  );
  const setFiltersOpen = useCallback(
    (value: boolean | ((current: boolean) => boolean)) => {
      setFiltersOpenState(value);
      resetPage();
    },
    [resetPage],
  );

  return {
    data,
    rows: filteredRows,
    paginatedRows,
    kpis,
    loading: branchLoading || loading,
    error,
    search,
    period,
    type,
    branchId,
    productId,
    filtersOpen,
    page: currentPage,
    pageSize,
    totalPages,
    setSearch,
    setPeriod,
    setType,
    setBranchId,
    setProductId,
    setFiltersOpen,
    setPage,
    setPageSize,
  };
}

function filterRows(
  rows: InventoryMovementRow[],
  filters: {
    search: string;
    period: MovementPeriodFilter;
    type: MovementTypeFilter;
    branchId: string;
    productId: string;
  },
) {
  const query = filters.search.trim().toLowerCase();
  const threshold = getPeriodThreshold(filters.period);
  return rows.filter((row) => {
    const createdAt = new Date(row.createdAt).getTime();
    const matchesPeriod = !threshold || createdAt >= threshold;
    const matchesType = filters.type === "all" || row.displayType === filters.type;
    const matchesBranch = filters.branchId === "all" || row.branchId === filters.branchId;
    const matchesProduct = !filters.productId || row.productId === filters.productId;
    const matchesSearch =
      !query ||
      [
        row.productName,
        row.sku,
        row.referenceLabel,
        row.userLabel,
        row.branchName,
        row.locationLabel,
        row.reason,
        row.typeLabel,
        row.adjustmentDetail?.number,
        row.adjustmentDetail?.notes,
        row.transferDetail?.number,
      ].some((value) => (value ?? "").toLowerCase().includes(query));
    return matchesPeriod && matchesType && matchesBranch && matchesProduct && matchesSearch;
  });
}

function getPeriodThreshold(period: MovementPeriodFilter) {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}
