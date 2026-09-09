"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { PosProductDto } from "@/modules/pos/application/dto/PosProductDto";
import { GetPosProductsService } from "@/modules/pos/application/services/GetPosProductsService";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

export function usePosTerminal() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const {
    user,
    canAccessBranch,
    loading: sessionLoading,
    error: sessionError,
  } = useCurrentSession();
  const service = useMemo(() => new GetPosProductsService(repositories), [repositories]);
  const [products, setProducts] = useState<PosProductDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (branchLoading || sessionLoading) return;

    if (!currentBranch || !user) {
      setProducts([]);
      setError(sessionError ?? "No hay una sesión o sucursal activa disponible.");
      setLoading(false);
      return;
    }

    if (user.tenantId !== currentBranch.tenantId || !canAccessBranch(currentBranch.id)) {
      setProducts([]);
      setError("No tienes acceso a la sucursal activa.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setProducts(
        await service.execute({
          tenantId: currentBranch.tenantId,
          branchId: currentBranch.id,
        }),
      );
    } catch {
      setProducts([]);
      setError("No se pudieron cargar los productos disponibles para POS.");
    } finally {
      setLoading(false);
    }
  }, [
    branchLoading,
    canAccessBranch,
    currentBranch,
    service,
    sessionError,
    sessionLoading,
    user,
  ]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });

    return () => {
      active = false;
    };
  }, [reload]);

  useDataEvent("product.changed", reload);
  useDataEvent("promotion.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);

  const filteredProducts = useMemo(
    () => filterPosProducts(products, search),
    [products, search],
  );

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    loading: branchLoading || sessionLoading || loading,
    error,
    reload,
  };
}

function filterPosProducts(products: PosProductDto[], search: string) {
  const query = search.trim().toLocaleLowerCase("es");
  if (!query) return products;

  return products.filter((product) =>
    [product.name, product.sku, product.barcode]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase("es").includes(query)),
  );
}
