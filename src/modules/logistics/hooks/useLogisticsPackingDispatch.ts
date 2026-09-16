"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataEventPayload } from "@/core/types/events.types";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type { PreparedOrderDetailDto, PreparedOrderQueueItemDto } from "@/modules/logistics/application/dto/DispatchReadModelDto";
import type { LogisticsItemTraceDto } from "@/modules/logistics/application/dto/LogisticsItemTraceDto";
import { DispatchApplicationService } from "@/modules/logistics/application/services/DispatchApplicationService";
import { GetLogisticsItemTraceService } from "@/modules/logistics/application/services/GetLogisticsItemTraceService";
import type { DispatchValidationResult } from "@/modules/logistics/validation/dispatch.validation";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { useEntitlementContext } from "@/shared/providers/EntitlementProvider";
import { SaasCapabilityKey } from "@/core/enums";

export function useLogisticsPackingDispatch() {
  const repositories = useRepositories();
  const { hasCapability } = useEntitlementContext();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const { user, canAccessBranch, hasPermission, loading: sessionLoading, error: sessionError } = useCurrentSession();
  const services = useMemo(() => ({ dispatch: new DispatchApplicationService(repositories), trace: new GetLogisticsItemTraceService(repositories) }), [repositories]);
  const [queue, setQueue] = useState<PreparedOrderQueueItemDto[]>([]);
  const [detail, setDetail] = useState<PreparedOrderDetailDto | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trace, setTrace] = useState<LogisticsItemTraceDto[]>([]);
  const [traceState, setTraceState] = useState<"idle" | "loading" | "data" | "empty" | "unauthorized" | "error">("idle");
  const [traceError, setTraceError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationIdRef = useRef("");
  const mutationLockRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const detailSequenceRef = useRef(0);
  const workspaceBranchIdRef = useRef<string | null>(null);
  const activeBranchIdRef = useRef<string | null>(currentBranch?.id ?? null);

  const hasBranchAccess = Boolean(user && currentBranch && user.tenantId === currentBranch.tenantId && canAccessBranch(currentBranch.id));
  const canRead = hasPermission("logistics.dispatch.read") && hasCapability(SaasCapabilityKey.delivery);
  const canReadTrace = hasPermission("logistics.picking.read");
  const canConfirm = hasPermission("logistics.dispatch.confirm") && hasCapability(SaasCapabilityKey.delivery);

  const reload = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    if (branchLoading || sessionLoading) return;
    setLoading(true);
    setError(null);
    if (!currentBranch || !hasBranchAccess || !canRead) {
      setQueue([]);
      setLoading(false);
      return;
    }
    try {
      const items = await services.dispatch.getPreparedQueue(currentBranch.id);
      if (sequence === loadSequenceRef.current) setQueue(items);
    } catch (cause) {
      if (sequence === loadSequenceRef.current) setError(toMessage(cause, sessionError ?? "No se pudo cargar la cola de despachos."));
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [branchLoading, canRead, currentBranch, hasBranchAccess, services, sessionError, sessionLoading]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    const activeBranchId = currentBranch?.id ?? null;
    activeBranchIdRef.current = activeBranchId;
    if (workspaceBranchIdRef.current && workspaceBranchIdRef.current !== activeBranchId) {
      detailSequenceRef.current += 1;
    }
    window.queueMicrotask(() => {
      if (!active) return;
      if (!workspaceBranchIdRef.current || workspaceBranchIdRef.current === activeBranchId) return;
      workspaceBranchIdRef.current = null;
      setSelectedOrderId(null);
      setDetail(null);
      setTrace([]);
      setTraceState("idle");
      setTraceError(null);
      setError(null);
      setDetailLoading(false);
    });
    return () => { active = false; };
  }, [currentBranch?.id]);

  const openOrder = useCallback(async (item: PreparedOrderQueueItemDto) => {
    if (!currentBranch || !hasBranchAccess) return;
    const requestId = ++detailSequenceRef.current;
    workspaceBranchIdRef.current = currentBranch.id;
    setSelectedOrderId(item.orderId);
    operationIdRef.current = crypto.randomUUID();
    setDetailLoading(true);
    setError(null);
    setDetail(null);
    setTrace([]);
    setTraceError(null);
    setTraceState(canReadTrace ? "loading" : "unauthorized");
    try {
      const [detailResult, traceResult] = await Promise.allSettled([
        services.dispatch.getPreparedDetail(currentBranch.id, item.orderId),
        canReadTrace
          ? services.trace.execute(currentBranch.id, { orderId: item.orderId, pickingOrderId: item.pickingOrderId })
          : Promise.resolve(null),
      ]);
      if (requestId !== detailSequenceRef.current || activeBranchIdRef.current !== currentBranch.id) return;
      if (detailResult.status === "rejected") {
        setError(toMessage(detailResult.reason, "No se pudo cargar el detalle del pedido."));
        return;
      }
      setDetail(detailResult.value);
      if (canReadTrace && traceResult.status === "fulfilled" && traceResult.value) {
        setTrace(traceResult.value);
        setTraceState(traceResult.value.length > 0 ? "data" : "empty");
      } else if (canReadTrace && traceResult.status === "rejected") {
        setTrace([]);
        setTraceState("error");
        setTraceError(toMessage(traceResult.reason, "No se pudo consultar la trazabilidad de picking."));
      }
    } finally {
      if (requestId === detailSequenceRef.current && activeBranchIdRef.current === currentBranch.id) setDetailLoading(false);
    }
  }, [canReadTrace, currentBranch, hasBranchAccess, services]);

  const closeOrder = useCallback(() => {
    if (submitting) return false;
    detailSequenceRef.current += 1;
    workspaceBranchIdRef.current = null;
    setSelectedOrderId(null);
    setDetail(null);
    setTrace([]);
    setTraceState("idle");
    setTraceError(null);
    setError(null);
    setDetailLoading(false);
    return true;
  }, [submitting]);

  const confirmDispatch = useCallback(async (validation: DispatchValidationResult) => {
    if (!currentBranch || !detail || !validation.valid || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await services.dispatch.confirm(currentBranch.id, {
        orderId: detail.orderId,
        operationId: operationIdRef.current,
        carrierName: validation.carrierName,
        trackingNumber: validation.trackingNumber,
        packages: validation.packages,
      });
      workspaceBranchIdRef.current = null;
      setSelectedOrderId(null);
      setDetail(null);
      setTrace([]);
      setTraceState("idle");
      setTraceError(null);
      await reload();
      return result;
    } catch (cause) {
      setError(toMessage(cause, "No se pudo confirmar el despacho."));
    } finally {
      mutationLockRef.current = false;
      setSubmitting(false);
    }
  }, [currentBranch, detail, reload, services]);

  const handleEvent = useCallback((payload: DataEventPayload) => {
    if (!currentBranch || payload.tenantId !== currentBranch.tenantId || payload.branchId !== currentBranch.id) return;
    void reload();
  }, [currentBranch, reload]);
  useDataEvent("order.changed", handleEvent);
  useDataEvent("dispatch.changed", handleEvent);

  const filteredQueue = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return queue;
    return queue.filter((item) => [item.orderReference, item.recipientName, item.recipientPhone ?? "", item.address?.line1 ?? "", item.address?.city ?? ""].some((value) => value.toLocaleLowerCase().includes(term)));
  }, [queue, search]);

  return {
    currentBranchName: currentBranch?.name ?? "Sin sucursal",
    hasBranchAccess,
    canRead,
    canReadTrace,
    canConfirm,
    queue: filteredQueue,
    search,
    setSearch,
    loading,
    detailLoading,
    submitting,
    detail,
    workspaceOpen: selectedOrderId !== null,
    trace,
    traceState,
    traceError,
    error,
    reload,
    openOrder,
    closeOrder,
    confirmDispatch,
  };
}

function toMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
