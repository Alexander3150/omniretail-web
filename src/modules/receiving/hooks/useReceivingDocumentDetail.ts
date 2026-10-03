"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReceiptIncidentEvidence } from "@/core/entities";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  CreateReceivingIncidentInput,
  ReceivingDocumentDetail,
  ReceivingDocumentIncident,
  ReceivingDocumentDetailType,
  ReceivingDocumentLine,
} from "@/modules/receiving/application/dto/ReceivingDocumentDetailDto";
import { ReceivingDocumentDetailService } from "@/modules/receiving/application/services/ReceivingDocumentDetailService";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import type { NumericInputValue } from "@/shared/utils/numberInput";

export function useReceivingDocumentDetail(
  documentType: ReceivingDocumentDetailType,
  documentId: string,
) {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const service = useMemo(() => new ReceivingDocumentDetailService(repositories), [repositories]);
  const [detail, setDetail] = useState<ReceivingDocumentDetail | null>(null);
  const [lines, setLines] = useState<ReceivingDocumentLine[]>([]);
  const [incidents, setIncidents] = useState<ReceivingDocumentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [incidentSaving, setIncidentSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState(() => crypto.randomUUID());
  const requestIdRef = useRef(0);
  const activeBranchIdRef = useRef(activeBranchId);
  const dirtyRef = useRef(false);
  const mutationPendingRef = useRef(false);
  const incidentMutationPendingRef = useRef(false);

  useEffect(() => {
    activeBranchIdRef.current = activeBranchId;
  }, [activeBranchId]);

  const updateDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!activeBranchId) {
      setDetail(null);
      setLines([]);
      setIncidents([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextDetail = await service.getDocument(documentType, documentId, activeBranchId);
      if (requestId !== requestIdRef.current) return;
      setDetail(nextDetail);
      setLines(nextDetail.lines);
      setIncidents(nextDetail.incidents);
      updateDirty(false);
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) return;
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeBranchId, documentId, documentType, service, updateDirty]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const reloadFromEvent = useCallback(async () => {
    if (dirtyRef.current || mutationPendingRef.current || incidentMutationPendingRef.current) return;
    await reload();
  }, [reload]);

  useDataEvent("receipt.changed", reloadFromEvent);
  useDataEvent("purchase-order.changed", reloadFromEvent);
  useDataEvent("inventory.changed", reloadFromEvent);
  useDataEvent("stock.changed", reloadFromEvent);
  useDataEvent("incident-type.changed", reloadFromEvent);
  useDataEvent("unit-conversion.changed", reloadFromEvent);
  useDataEvent("supplier-product.changed", reloadFromEvent);
  useDataEvent("business-config.changed", reloadFromEvent);

  const updateLine = useCallback((lineId: string, patch: Partial<ReceivingDocumentLine>) => {
    updateDirty(true);
    setLines((current) =>
      current.map((line) => (line.id === lineId ? recalculateLine({ ...line, ...patch }) : line)),
    );
  }, [updateDirty]);

  const updateLineQuantity = useCallback(
    (lineId: string, value: NumericInputValue) => {
      updateLine(lineId, { receivedNow: value });
    },
    [updateLine],
  );

  const saveProgress = useCallback(async () => {
    if (mutationPendingRef.current || incidentMutationPendingRef.current) return;
    const mutationBranchId = activeBranchIdRef.current;
    mutationPendingRef.current = true;
    setSaving(true);
    try {
      await service.saveProgress({
        documentType,
        documentId,
        lines,
        incidents,
      });
      if (activeBranchIdRef.current !== mutationBranchId) return;
      await reload();
    } finally {
      mutationPendingRef.current = false;
      setSaving(false);
    }
  }, [documentId, documentType, incidents, lines, reload, service]);

  const confirm = useCallback(async () => {
    if (mutationPendingRef.current || incidentMutationPendingRef.current) return;
    const mutationBranchId = activeBranchIdRef.current;
    mutationPendingRef.current = true;
    setSaving(true);
    try {
      await service.confirm({
        documentType,
        documentId,
        lines,
        incidents,
        confirmationId,
        hasUnsavedChanges: dirtyRef.current,
      });
      if (activeBranchIdRef.current !== mutationBranchId) return;
      await reload();
      setConfirmationId(crypto.randomUUID());
    } catch (caughtError) {
      if (
        caughtError instanceof BackendRequestError &&
        caughtError.code === "RECEIPT_HAS_OPEN_INCIDENTS" &&
        activeBranchIdRef.current === mutationBranchId
      ) {
        await reload();
      }
      throw caughtError;
    } finally {
      mutationPendingRef.current = false;
      setSaving(false);
    }
  }, [confirmationId, documentId, documentType, incidents, lines, reload, service]);

  const saveIncident = useCallback(
    (input: {
      id?: string;
      productId: string;
      incidentTypeId: string;
      quantityAffected: number;
      description: string;
      evidence: ReceiptIncidentEvidence[];
    }) => {
      if (!detail) return;
      const line = lines.find((item) => item.productId === input.productId);
      const incidentType = detail.incidentTypes.find((item) => item.id === input.incidentTypeId);
      if (!line || !incidentType) throw new Error("La incidencia no tiene referencias validas.");
      const existing = input.id ? incidents.find((item) => item.id === input.id) : undefined;
      const otherIncidentQuantity = incidents
        .filter(
          (item) => item.editable && item.productId === input.productId && item.id !== existing?.id,
        )
        .reduce((sum, item) => sum + (item.quantityAffected ?? 0), 0);
      const remainingBefore = Math.max(0, line.orderedQuantity - line.acceptedPreviously);
      const acceptedNow = typeof line.receivedNow === "number" ? line.receivedNow : 0;
      if (acceptedNow + otherIncidentQuantity + input.quantityAffected > remainingBefore) {
        throw new Error(
          `Solo quedan ${Math.max(0, remainingBefore - acceptedNow - otherIncidentQuantity)} unidades disponibles para registrar entre aceptadas e incidencias.`,
        );
      }
      const nextIncident: ReceivingDocumentIncident = {
        id: existing?.id ?? `draft-${crypto.randomUUID()}`,
        receiptId: existing?.receiptId ?? detail.document.receiptId ?? "",
        ...(existing?.receiptLineId ? { receiptLineId: existing.receiptLineId } : {}),
        productId: input.productId,
        productName: line.productName,
        sku: line.sku,
        incidentTypeId: input.incidentTypeId,
        incidentTypeName: incidentType.name,
        quantityAffected: input.quantityAffected,
        description: input.description.trim(),
        evidence: input.evidence,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        createdByUserId: existing?.createdByUserId ?? "user-warehouse",
        createdByName: existing?.createdByName ?? "Usuario de bodega",
        receiptNumber:
          existing?.receiptNumber ?? detail.document.receiptNumber ?? "Borrador actual",
        editable: true,
      };
      const nextIncidents = existing
        ? incidents.map((item) => (item.id === existing.id ? nextIncident : item))
        : [...incidents, nextIncident];
      setIncidents(nextIncidents);
      setLines((current) => current.map((item) => recalculateLine(item)));
      updateDirty(true);
    },
    [detail, incidents, lines, updateDirty],
  );

  const removeIncident = useCallback(
    (incidentId: string) => {
      const nextIncidents = incidents.filter(
        (incident) => incident.id !== incidentId || !incident.editable,
      );
      setIncidents(nextIncidents);
      setLines((current) => current.map((item) => recalculateLine(item)));
      updateDirty(true);
    },
    [incidents, updateDirty],
  );

  const createApiIncident = useCallback(
    async (input: Omit<CreateReceivingIncidentInput, "documentId" | "receiptId">) => {
      if (!detail?.document.receiptId) {
        throw new Error("Guarda el borrador antes de registrar una incidencia.");
      }
      if (dirtyRef.current) {
        throw new Error("Guarda los cambios del borrador antes de registrar la incidencia.");
      }
      if (incidentMutationPendingRef.current || mutationPendingRef.current) return;
      const mutationBranchId = activeBranchIdRef.current;
      incidentMutationPendingRef.current = true;
      setIncidentSaving(true);
      try {
        await service.createIncident({
          documentId,
          receiptId: detail.document.receiptId,
          ...input,
        });
        if (activeBranchIdRef.current !== mutationBranchId) return;
        await reload();
      } finally {
        incidentMutationPendingRef.current = false;
        setIncidentSaving(false);
      }
    },
    [detail?.document.receiptId, documentId, reload, service],
  );

  const resolveApiIncident = useCallback(
    async (incidentId: string) => {
      if (!detail?.document.receiptId) {
        throw new Error("No se encontró el borrador asociado a la incidencia.");
      }
      if (incidentMutationPendingRef.current || mutationPendingRef.current) return;
      const mutationBranchId = activeBranchIdRef.current;
      incidentMutationPendingRef.current = true;
      setIncidentSaving(true);
      try {
        await service.resolveIncident(documentId, detail.document.receiptId, incidentId);
        if (activeBranchIdRef.current !== mutationBranchId) return;
        await reload();
      } finally {
        incidentMutationPendingRef.current = false;
        setIncidentSaving(false);
      }
    },
    [detail?.document.receiptId, documentId, reload, service],
  );

  const apiMode = repositories.receivingDataSource === "api";
  const apiPurchaseOrder = apiMode && documentType === "purchase_order";

  return {
    detail,
    lines,
    incidents,
    currentBranch,
    loading: branchLoading || loading,
    saving,
    incidentSaving,
    dirty,
    error,
    apiMode,
    confirmAvailable: !apiMode || Boolean(apiPurchaseOrder && detail?.canConfirm),
    incidentsAvailable:
      !apiMode ||
      Boolean(apiPurchaseOrder && detail?.canManageIncidents && detail.document.receiptId),
    reload,
    updateLine,
    updateLineQuantity,
    saveProgress,
    confirm,
    saveIncident,
    removeIncident,
    createApiIncident,
    resolveApiIncident,
  };
}

function recalculateLine(line: ReceivingDocumentLine) {
  const receivedNow = typeof line.receivedNow === "number" ? line.receivedNow : 0;
  return {
    ...line,
    pendingQuantity: Math.max(0, line.orderedQuantity - line.acceptedPreviously - receivedNow),
  };
}
