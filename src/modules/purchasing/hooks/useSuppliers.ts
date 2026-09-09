"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SupplierListItemReadModel,
  SupplierStatusFilter,
} from "@/modules/purchasing/application/dto/SupplierReadModel";
import { GetSuppliersReadModelService } from "@/modules/purchasing/application/services/GetSuppliersReadModelService";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

interface SupplierFilters {
  search: string;
  status: SupplierStatusFilter;
}

const DEFAULT_FILTERS: SupplierFilters = {
  search: "",
  status: "active",
};

export function useSuppliers() {
  const repositories = useRepositories();
  const service = useMemo(() => new GetSuppliersReadModelService(repositories), [repositories]);
  const [suppliers, setSuppliers] = useState<SupplierListItemReadModel[]>([]);
  const [filters, setFilters] = useState<SupplierFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.execute();
      setSuppliers(data.suppliers);
    } catch {
      setError("No se pudieron cargar los proveedores.");
    } finally {
      setLoading(false);
    }
  }, [service]);

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

  useDataEvent("supplier.changed", reload);
  useDataEvent("supplier-product.changed", reload);
  useDataEvent("purchase-order.changed", reload);
  useDataEvent("receipt.changed", reload);
  useDataEvent("product.changed", reload);

  const filteredSuppliers = useMemo(
    () => filterSuppliers(suppliers, filters),
    [filters, suppliers],
  );

  const updateFilters = useCallback((patch: Partial<SupplierFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  return {
    suppliers,
    filteredSuppliers,
    filters,
    loading,
    error,
    updateFilters,
  };
}

function filterSuppliers(
  suppliers: SupplierListItemReadModel[],
  filters: SupplierFilters,
) {
  const search = normalize(filters.search);
  return suppliers.filter((supplier) => {
    const matchesStatus =
      filters.status === "archived" ? supplier.archived : !supplier.archived;
    const matchesSearch = !search || supplier.searchText.includes(search);
    return matchesStatus && matchesSearch;
  });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
