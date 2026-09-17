"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeliveryMethod, OrderStatus } from "@/core/enums";
import type { DataEventPayload } from "@/core/types/events.types";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import type {
  PackingActionResultDto,
  PackingDetailDto,
  PackingQueueItemDto,
} from "@/modules/logistics/application/dto/PackingReadModelDto";
import { PackingApplicationService } from "@/modules/logistics/application/services/PackingApplicationService";
import type { PackingPreparationValidationResult } from "@/modules/logistics/validation/packing.validation";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

export function useLogisticsPacking() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const { user, canAccessBranch, hasPermission, loading: sessionLoading, error: sessionError } = useCurrentSession();
  const service = useMemo(() => new PackingApplicationService(repositories), [repositories]);
  const [queue, setQueue] = useState<PackingQueueItemDto[]>([]);
  const [detail, setDetail] = useState<PackingDetailDto | null>(null);
  const [selectedPackingId, setSelectedPackingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{
    orderReference: string; orderStatus: OrderStatus | null; sourceType?: "transfer";
  } | null>(null);
  const activeBranchIdRef = useRef<string | null>(currentBranch?.id ?? null);
  const selectedPackingIdRef = useRef<string | null>(null);
  const workspaceBranchIdRef = useRef<string | null>(null);
  const loadSequenceRef = useRef(0);
  const detailSequenceRef = useRef(0);
  const mutationSequenceRef = useRef(0);
  const mutationLockRef = useRef(false);
  const pendingOperationIdsRef = useRef(new Map<string, string>());

  const hasBranchAccess = Boolean(
    user && currentBranch && user.tenantId === currentBranch.tenantId && canAccessBranch(currentBranch.id),
  );
  const canRead = hasPermission("logistics.packing.read");
  const canPrepare = hasPermission("logistics.packing.prepare");
  const canFinalize = hasPermission("logistics.packing.finalize");

  const reload = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    if (branchLoading || sessionLoading) return;
    setLoading(true);
    setQueueError(null);
    if (!currentBranch || !hasBranchAccess || !canRead) {
      setQueue([]);
      setLoading(false);
      return;
    }
    try {
      const items = await service.getQueue(currentBranch.id);
      if (sequence === loadSequenceRef.current && activeBranchIdRef.current === currentBranch.id) {
        setQueue(items);
      }
    } catch (cause) {
      if (sequence === loadSequenceRef.current) {
        setQueueError(toMessage(cause, sessionError ?? "No se pudo cargar la cola de Packing."));
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [branchLoading, canRead, currentBranch, hasBranchAccess, service, sessionError, sessionLoading]);

  const loadDetail = useCallback(async (branchId: string, packingId: string) => {
    const sequence = ++detailSequenceRef.current;
    setDetailLoading(true);
    setWorkspaceError(null);
    try {
      const result = await service.getDetail(branchId, packingId);
      if (
        sequence === detailSequenceRef.current &&
        activeBranchIdRef.current === branchId &&
        selectedPackingIdRef.current === packingId
      ) {
        setDetail(result);
      }
      return result;
    } catch (cause) {
      if (sequence === detailSequenceRef.current && activeBranchIdRef.current === branchId) {
        setWorkspaceError(toMessage(cause, "No se pudo cargar la preparación."));
      }
      return null;
    } finally {
      if (sequence === detailSequenceRef.current && activeBranchIdRef.current === branchId) {
        setDetailLoading(false);
      }
    }
  }, [service]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    const branchId = currentBranch?.id ?? null;
    activeBranchIdRef.current = branchId;
    if (workspaceBranchIdRef.current && workspaceBranchIdRef.current !== branchId) {
      detailSequenceRef.current += 1;
      mutationSequenceRef.current += 1;
      mutationLockRef.current = false;
    }
    window.queueMicrotask(() => {
      if (!active || !workspaceBranchIdRef.current || workspaceBranchIdRef.current === branchId) return;
      workspaceBranchIdRef.current = null;
      selectedPackingIdRef.current = null;
      pendingOperationIdsRef.current.clear();
      setSelectedPackingId(null);
      setDetail(null);
      setWorkspaceError(null);
      setCompletion(null);
      setDetailLoading(false);
      setSubmitting(false);
    });
    return () => { active = false; };
  }, [currentBranch?.id]);

  const selectPacking = useCallback(async (packingId: string) => {
    if (!currentBranch || !hasBranchAccess || !canRead || mutationLockRef.current) return;
    workspaceBranchIdRef.current = currentBranch.id;
    selectedPackingIdRef.current = packingId;
    setSelectedPackingId(packingId);
    setDetail(null);
    setWorkspaceError(null);
    setCompletion(null);
    await loadDetail(currentBranch.id, packingId);
  }, [canRead, currentBranch, hasBranchAccess, loadDetail]);

  const executeMutation = useCallback(async <Result extends PackingActionResultDto>(
    allowed: boolean,
    actionKey: string,
    fallbackError: string,
    execute: (input: {
      branchId: string;
      packingId: string;
      expectedVersion: number;
      operationId: string;
    }) => Promise<Result>,
  ) => {
    if (!allowed || !currentBranch || !detail || mutationLockRef.current) return null;
    mutationLockRef.current = true;
    const sequence = ++mutationSequenceRef.current;
    const branchId = currentBranch.id;
    const packingId = detail.packingId;
    const operationKey = `${actionKey}:${packingId}:${detail.version}`;
    const operationId = pendingOperationIdsRef.current.get(operationKey) ?? crypto.randomUUID();
    pendingOperationIdsRef.current.set(operationKey, operationId);
    setSubmitting(true);
    setWorkspaceError(null);
    try {
      const result = await execute({
        branchId,
        packingId,
        expectedVersion: detail.version,
        operationId,
      });
      pendingOperationIdsRef.current.delete(operationKey);
      if (
        sequence !== mutationSequenceRef.current ||
        activeBranchIdRef.current !== branchId ||
        selectedPackingIdRef.current !== packingId
      ) return null;
      setDetail(result.packing);
      await reload();
      return result;
    } catch (cause) {
      if (activeBranchIdRef.current === branchId && selectedPackingIdRef.current === packingId) {
        setWorkspaceError(toMessage(cause, fallbackError));
      }
      return null;
    } finally {
      if (sequence === mutationSequenceRef.current) {
        mutationLockRef.current = false;
        setSubmitting(false);
      }
    }
  }, [currentBranch, detail, reload]);

  const savePreparation = useCallback(async (
    validation: PackingPreparationValidationResult,
  ) => {
    if (!validation.valid || !currentBranch || !detail || !canPrepare || mutationLockRef.current) return false;
    mutationLockRef.current = true;
    const sequence = ++mutationSequenceRef.current;
    const branchId = currentBranch.id;
    const packingId = detail.packingId;
    const fingerprint = `${packingId}:${detail.version}:${JSON.stringify(validation.values)}`;
    const operationId = pendingOperationIdsRef.current.get(fingerprint) ?? crypto.randomUUID();
    pendingOperationIdsRef.current.set(fingerprint, operationId);
    setSubmitting(true);
    setWorkspaceError(null);
    try {
      const result = await service.savePreparation(branchId, {
        packingId,
        operationId,
        expectedVersion: detail.version,
        ...validation.values,
      });
      pendingOperationIdsRef.current.delete(fingerprint);
      if (
        sequence !== mutationSequenceRef.current ||
        activeBranchIdRef.current !== branchId ||
        selectedPackingIdRef.current !== packingId
      ) return false;
      setDetail(result.packing);
      await reload();
      return true;
    } catch (cause) {
      if (activeBranchIdRef.current === branchId && selectedPackingIdRef.current === packingId) {
        setWorkspaceError(toMessage(cause, "No se pudo guardar la preparación."));
      }
      return false;
    } finally {
      if (sequence === mutationSequenceRef.current) {
        mutationLockRef.current = false;
        setSubmitting(false);
      }
    }
  }, [canPrepare, currentBranch, detail, reload, service]);

  const generateLabel = useCallback(async () => {
    const result = await executeMutation(
      canPrepare,
      "generate-label",
      "No se pudo generar la etiqueta.",
      ({ branchId, ...command }) => service.generateLabel(branchId, command),
    );
    return Boolean(result);
  }, [canPrepare, executeMutation, service]);

  const registerLabelPrint = useCallback(async () => {
    const labelGenerationId = detail?.labelGenerationId;
    if (!labelGenerationId) return false;
    const result = await executeMutation(
      canPrepare,
      `print-label:${labelGenerationId}`,
      "No se pudo registrar la impresión de la etiqueta.",
      ({ branchId, ...command }) => service.registerLabelPrint(branchId, {
        ...command,
        labelGenerationId,
      }),
    );
    return Boolean(result);
  }, [canPrepare, detail?.labelGenerationId, executeMutation, service]);

  const finalize = useCallback(async () => {
    const orderReference = detail?.orderReference;
    const deliveryMethod = detail?.deliveryMethod;
    const result = await executeMutation(
      canFinalize,
      "finalize",
      "No se pudo finalizar el empaque.",
      ({ branchId, ...command }) => service.finalize(branchId, command),
    );
    if (!result || !orderReference) return false;
    if (deliveryMethod === DeliveryMethod.store_pickup) {
      setCompletion(null);
      return true;
    }
    detailSequenceRef.current += 1;
    workspaceBranchIdRef.current = null;
    selectedPackingIdRef.current = null;
    pendingOperationIdsRef.current.clear();
    setSelectedPackingId(null);
    setDetail(null);
    setWorkspaceError(null);
    setCompletion({ orderReference, orderStatus: result.orderStatus,
      sourceType: deliveryMethod === "transfer" ? "transfer" : undefined });
    await reload();
    return true;
  }, [canFinalize, detail?.deliveryMethod, detail?.orderReference, executeMutation, reload, service]);

  const confirmStorePickupDelivery = useCallback(async () => {
    if (
      !canFinalize ||
      !currentBranch ||
      !detail ||
      detail.deliveryMethod !== DeliveryMethod.store_pickup ||
      mutationLockRef.current
    ) return false;
    mutationLockRef.current = true;
    const sequence = ++mutationSequenceRef.current;
    const branchId = currentBranch.id;
    const packingId = detail.packingId;
    const operationKey = `confirm-store-pickup:${packingId}`;
    const operationId = pendingOperationIdsRef.current.get(operationKey) ?? crypto.randomUUID();
    pendingOperationIdsRef.current.set(operationKey, operationId);
    setSubmitting(true);
    setWorkspaceError(null);
    try {
      const result = await service.confirmStorePickupDelivery(branchId, { packingId, operationId });
      pendingOperationIdsRef.current.delete(operationKey);
      if (
        sequence !== mutationSequenceRef.current ||
        activeBranchIdRef.current !== branchId ||
        selectedPackingIdRef.current !== packingId
      ) return false;
      detailSequenceRef.current += 1;
      workspaceBranchIdRef.current = null;
      selectedPackingIdRef.current = null;
      setSelectedPackingId(null);
      setDetail(null);
      setWorkspaceError(null);
      setCompletion({ orderReference: detail.orderReference, orderStatus: result.orderStatus });
      await reload();
      return true;
    } catch (cause) {
      if (activeBranchIdRef.current === branchId && selectedPackingIdRef.current === packingId) {
        setWorkspaceError(toMessage(cause, "No se pudo confirmar la entrega al cliente."));
      }
      return false;
    } finally {
      if (sequence === mutationSequenceRef.current) {
        mutationLockRef.current = false;
        setSubmitting(false);
      }
    }
  }, [canFinalize, currentBranch, detail, reload, service]);

  const handleEvent = useCallback((payload: DataEventPayload) => {
    if (!currentBranch || payload.tenantId !== currentBranch.tenantId || payload.branchId !== currentBranch.id) return;
    void reload();
    const packingId = selectedPackingIdRef.current;
    if (packingId && !mutationLockRef.current) void loadDetail(currentBranch.id, packingId);
  }, [currentBranch, loadDetail, reload]);
  useDataEvent("packing.changed", handleEvent);
  useDataEvent("order.changed", handleEvent);

  const filteredQueue = useMemo(() => filterPackingQueue(queue, search), [queue, search]);

  return {
    currentBranchName: currentBranch?.name ?? "Sin sucursal",
    hasBranchAccess,
    canRead,
    canPrepare,
    canFinalize,
    queue: filteredQueue,
    search,
    setSearch,
    loading,
    detailLoading,
    submitting,
    detail,
    selectedPackingId,
    queueError,
    workspaceError,
    completion,
    reload,
    selectPacking,
    savePreparation,
    generateLabel,
    registerLabelPrint,
    finalize,
    confirmStorePickupDelivery,
  };
}

export function filterPackingQueue(queue: PackingQueueItemDto[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return queue;
  return queue.filter((item) =>
    [item.orderReference, item.customerName, item.deliveryMethod, item.status]
      .some((value) => value.toLocaleLowerCase().includes(term)),
  );
}

function toMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
