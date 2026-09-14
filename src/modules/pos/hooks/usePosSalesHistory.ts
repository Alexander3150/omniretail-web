"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataEventPayload } from "@/core/types/events.types";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import {
  defaultPosSaleHistoryFilters,
  type PosSaleHistoryDto,
  type PosSaleHistoryFilters,
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
      setHistory(nextHistory);
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
  };
}
