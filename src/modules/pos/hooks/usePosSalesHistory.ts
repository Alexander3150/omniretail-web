"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataEventPayload } from "@/core/types/events.types";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import {
  defaultPosSaleHistoryFilters,
  isPosSaleHistoryDetailLoaded,
  type PosSaleHistoryDto,
  type PosSaleHistoryFilters,
  type PosSaleHistoryItemDto,
} from "@/modules/pos/application/dto/PosSaleHistoryDto";
import { GetPosSalesHistoryService } from "@/modules/pos/application/services/GetPosSalesHistoryService";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

const emptyHistory: PosSaleHistoryDto = {
  sales: [],
  summary: { total: 0, active: 0, partiallyReturned: 0, returned: 0, cancelled: 0 },
};

export function usePosSalesHistory(enabled = true) {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const {
    user,
    canAccessBranch,
    hasPermission,
    loading: sessionLoading,
    error: sessionError,
  } = useCurrentSession();
  const service = useMemo(() => new GetPosSalesHistoryService(repositories), [repositories]);
  const [filters, setFilters] = useState<PosSaleHistoryFilters>(defaultPosSaleHistoryFilters);
  const [history, setHistory] = useState<PosSaleHistoryDto>(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  // Detalles cargados bajo demanda (modo API); se descartan al recargar el listado.
  const [details, setDetails] = useState<Record<string, PosSaleHistoryItemDto>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailSequenceRef = useRef(0);

  const hasBranchAccess = Boolean(
    user &&
    currentBranch &&
    user.tenantId === currentBranch.tenantId &&
    canAccessBranch(currentBranch.id),
  );
  const canRead = hasPermission("pos.sales.read");
  const contextLoading = branchLoading || sessionLoading;
  const accessBlocked =
    !contextLoading && (!user || !currentBranch || !hasBranchAccess || !canRead);

  const reload = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    if (!enabled) {
      setLoading(false);
      return;
    }
    if (contextLoading) return;
    if (!user || !currentBranch || !hasBranchAccess || !canRead) {
      setHistory(emptyHistory);
      setError(
        sessionError ??
          "Necesitas permiso de consulta y acceso a una sucursal activa para ver el historial.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextHistory = await service.execute({
        actorUserId: user.id,
        branchId: currentBranch.id,
        filters,
      });
      if (requestId !== requestSequenceRef.current) return;
      detailSequenceRef.current += 1;
      setHistory(nextHistory);
      setDetails({});
      setDetailLoadingId(null);
      setDetailError(null);
    } catch (failure) {
      if (requestId !== requestSequenceRef.current) return;
      setHistory(emptyHistory);
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : "No se pudo cargar el historial de ventas.",
      );
    } finally {
      if (requestId === requestSequenceRef.current) setLoading(false);
    }
  }, [
    canRead,
    contextLoading,
    currentBranch,
    enabled,
    filters,
    hasBranchAccess,
    service,
    sessionError,
    user,
  ]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
      requestSequenceRef.current += 1;
    };
  }, [reload]);

  const refreshForScopedEvent = useCallback(
    (payload: DataEventPayload) => {
      if (!currentBranch || payload.tenantId !== currentBranch.tenantId) return;
      if (payload.branchId && payload.branchId !== currentBranch.id) return;
      void reload();
    },
    [currentBranch, reload],
  );
  useDataEvent("sale.changed", refreshForScopedEvent);
  useDataEvent("sale.returned", refreshForScopedEvent);
  useDataEvent("sale.voided", refreshForScopedEvent);
  useDataEvent("order.changed", refreshForScopedEvent);
  useDataEvent("payment.changed", refreshForScopedEvent);

  const getLoadedSale = useCallback(
    (saleId: string): PosSaleHistoryItemDto | null => {
      const row = history.sales.find((sale) => sale.saleId === saleId);
      if (!row) return null;
      return isPosSaleHistoryDetailLoaded(row) ? row : (details[saleId] ?? null);
    },
    [details, history.sales],
  );

  /** Pide el detalle de una sola venta (al seleccionarla o abrir sus productos). */
  const loadSaleDetail = useCallback(
    async (saleId: string): Promise<PosSaleHistoryItemDto | null> => {
      const loaded = getLoadedSale(saleId);
      if (loaded) return loaded;
      const row = history.sales.find((sale) => sale.saleId === saleId);
      if (!row || !user || !currentBranch) return null;
      const sequence = ++detailSequenceRef.current;
      setDetailLoadingId(saleId);
      setDetailError(null);
      try {
        const sale = await service.getSaleDetail({
          actorUserId: user.id,
          branchId: currentBranch.id,
          sale: row,
        });
        if (sequence !== detailSequenceRef.current) return null;
        setDetails((current) => ({ ...current, [saleId]: sale }));
        return sale;
      } catch (failure) {
        if (sequence !== detailSequenceRef.current) return null;
        setDetailError(
          failure instanceof Error && failure.message
            ? failure.message
            : "No se pudo cargar el detalle de la venta.",
        );
        return null;
      } finally {
        if (sequence === detailSequenceRef.current) setDetailLoadingId(null);
      }
    },
    [currentBranch, getLoadedSale, history.sales, service, user],
  );

  const updateFilters = useCallback((patch: Partial<PosSaleHistoryFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultPosSaleHistoryFilters), []);

  return {
    ...history,
    filters,
    loading: enabled && (contextLoading || loading),
    error,
    accessBlocked,
    currentBranchName: currentBranch?.name ?? null,
    reload,
    updateFilters,
    resetFilters,
    getLoadedSale,
    loadSaleDetail,
    detailLoadingId,
    detailError,
  };
}
