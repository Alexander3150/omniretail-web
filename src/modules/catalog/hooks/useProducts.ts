"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductStatus, ProductType } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductsService } from "@/modules/catalog/application/services/GetProductsService";
import type { ProductFiltersState, ProductListItem } from "@/modules/catalog/types/catalog.types";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = "name,asc" as const;
const SEARCH_DEBOUNCE_MS = 350;

const initialFilters: ProductFiltersState = {
  search: "",
  status: "all",
  productType: "all",
  categoryId: "all",
  channels: [],
  promotion: "all",
};

export function useProducts() {
  const repositories = useRepositories();
  const service = useMemo(() => new GetProductsService(repositories), [repositories]);
  const { currentBranch } = useActiveBranch();
  const branchId = currentBranch?.id;
  const requestBranchId = repositories.productDataSource === "mock" ? branchId : undefined;
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [filters, setFilters] = useState<ProductFiltersState>(initialFilters);
  const filtersRef = useRef(initialFilters);
  const requestedSearchRef = useRef(initialFilters.search);
  const [requestSearch, setRequestSearch] = useState(initialFilters.search);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const filtersEnabled = true;
  const searchInput = filters.search;
  const filterStatus = filters.status;
  const filterProductType = filters.productType;
  const filterCategoryId = filters.categoryId;
  const filterChannels = filters.channels;
  const filterPromotion = filters.promotion;
  const requestFilters = useMemo<ProductFiltersState>(
    () => ({
      search: requestSearch,
      status: filterStatus,
      productType: filterProductType,
      categoryId: filterCategoryId,
      channels: filterChannels,
      promotion: filterPromotion,
    }),
    [
      filterCategoryId,
      filterChannels,
      filterProductType,
      filterPromotion,
      filterStatus,
      requestSearch,
    ],
  );

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const result = await service.execute({
        branchId: requestBranchId,
        page,
        pageSize,
        sort: DEFAULT_SORT,
        filters: requestFilters,
      });
      if (requestIdRef.current !== requestId) return;
      if (result.totalPages > 0 && result.page > result.totalPages) {
        setPageState(result.totalPages);
        return;
      }
      setItems(result.items);
      setPageState(result.page);
      setPageSizeState(result.pageSize);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
    } catch (caughtError) {
      if (requestIdRef.current !== requestId) return;
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("No se pudieron cargar los productos."),
      );
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [page, pageSize, requestBranchId, requestFilters, service]);

  useDataEvent("product.changed", reload);
  const reloadAfterPromotionChange = useCallback(
    (payload?: { tenantId?: string }) => {
      service.invalidatePromotions(payload?.tenantId);
      void reload();
    },
    [reload, service],
  );
  useDataEvent("promotion.changed", reloadAfterPromotionChange);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void service
      .execute({
        branchId: requestBranchId,
        page,
        pageSize,
        sort: DEFAULT_SORT,
        filters: requestFilters,
      })
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setError(null);
        if (result.totalPages > 0 && result.page > result.totalPages) {
          setPageState(result.totalPages);
          return;
        }
        setItems(result.items);
        setPageState(result.page);
        setPageSizeState(result.pageSize);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
      })
      .catch((caughtError: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error("No se pudieron cargar los productos."),
        );
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [page, pageSize, requestBranchId, requestFilters, service]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalizedSearch = searchInput.trim();
      if (requestedSearchRef.current === normalizedSearch) return;
      requestedSearchRef.current = normalizedSearch;
      setLoading(true);
      setError(null);
      setPageState(1);
      setRequestSearch(normalizedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const updateFilters = useCallback((nextFilters: Partial<ProductFiltersState>) => {
    const current = filtersRef.current;
    const next = { ...current, ...nextFilters };
    if (areProductFiltersEqual(current, next)) return;

    const requestFilterChanged = didNonSearchFilterChange(current, next);
    filtersRef.current = next;
    setFilters(next);
    if (!requestFilterChanged) return;

    setLoading(true);
    setError(null);
    setPageState(1);
  }, []);

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (nextPageSize === pageSize) return;
      setLoading(true);
      setError(null);
      setPageSizeState(nextPageSize);
      setPageState(1);
    },
    [pageSize],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return;
      setLoading(true);
      setError(null);
      setPageState(nextPage);
    },
    [page],
  );

  return {
    loading,
    error,
    items,
    filters,
    filtersEnabled,
    page,
    pageSize,
    totalItems,
    totalPages,
    setPage,
    setPageSize,
    updateFilters,
    reload,
  };
}

export const productStatusOptions = Object.values(ProductStatus);
export const productTypeOptions = Object.values(ProductType);

function areProductFiltersEqual(
  left: ProductFiltersState,
  right: ProductFiltersState,
): boolean {
  return (
    left.search === right.search &&
    !didNonSearchFilterChange(left, right)
  );
}

function didNonSearchFilterChange(
  left: ProductFiltersState,
  right: ProductFiltersState,
): boolean {
  return (
    left.status !== right.status ||
    left.productType !== right.productType ||
    left.categoryId !== right.categoryId ||
    left.promotion !== right.promotion ||
    left.channels.length !== right.channels.length ||
    left.channels.some((channel, index) => channel !== right.channels[index])
  );
}
