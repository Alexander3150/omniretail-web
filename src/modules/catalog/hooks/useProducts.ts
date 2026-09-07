"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductStatus, ProductType } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { GetProductsService } from "@/modules/catalog/application/services/GetProductsService";
import type { ProductFiltersState, ProductListItem } from "@/modules/catalog/types/catalog.types";

const PAGE_SIZE = 10;

const initialFilters: ProductFiltersState = {
  search: "",
  status: "all",
  productType: "all",
  categoryId: "all",
  channel: "all",
};

export function useProducts() {
  const repositories = useRepositories();
  const service = useMemo(() => new GetProductsService(repositories), [repositories]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [filters, setFilters] = useState<ProductFiltersState>(initialFilters);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await service.execute());
    } catch {
      setError("No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useDataEvent("product.changed", reload);

  useEffect(() => {
    let active = true;
    service
      .execute()
      .then((nextProducts) => {
        if (!active) return;
        setProducts(nextProducts);
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los productos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service]);

  const filteredProducts = useMemo(() => filterProducts(products, filters), [filters, products]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const updateFilters = useCallback((nextFilters: Partial<ProductFiltersState>) => {
    setFilters((current) => ({ ...current, ...nextFilters }));
    setPage(1);
  }, []);

  return {
    loading,
    error,
    products,
    filteredProducts,
    paginatedProducts,
    filters,
    page: currentPage,
    pageSize: PAGE_SIZE,
    totalPages,
    setPage,
    updateFilters,
    reload,
  };
}

function filterProducts(products: ProductListItem[], filters: ProductFiltersState) {
  const query = filters.search.trim().toLowerCase();

  return products.filter((product) => {
    const matchesSearch =
      !query ||
      [product.name, product.sku, product.barcode, product.brand]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" || product.status === filters.status;
    const matchesType =
      filters.productType === "all" || product.productType === filters.productType;
    const matchesCategory =
      filters.categoryId === "all" || product.categoryId === filters.categoryId;
    const matchesChannel = filters.channel === "all" || product.channels[filters.channel];

    return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesChannel;
  });
}

export const productStatusOptions = Object.values(ProductStatus);
export const productTypeOptions = Object.values(ProductType);
