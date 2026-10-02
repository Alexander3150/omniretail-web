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
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [filters, setFilters] = useState<ProductFiltersState>(initialFilters);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const filtersEnabled = repositories.productDataSource === "mock";

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const result = await service.execute({
        branchId,
        page,
        pageSize,
        sort: DEFAULT_SORT,
        filters,
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
  }, [branchId, filters, page, pageSize, service]);

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void service
      .execute({
        branchId,
        page,
        pageSize,
        sort: DEFAULT_SORT,
        filters,
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
  }, [branchId, filters, page, pageSize, service]);

  const updateFilters = useCallback((nextFilters: Partial<ProductFiltersState>) => {
    setLoading(true);
    setError(null);
    setFilters((current) => ({ ...current, ...nextFilters }));
    setPageState(1);
  }, []);

  const setPageSize = useCallback((nextPageSize: number) => {
    setLoading(true);
    setError(null);
    setPageSizeState(nextPageSize);
    setPageState(1);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    setLoading(true);
    setError(null);
    setPageState(nextPage);
  }, []);

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
