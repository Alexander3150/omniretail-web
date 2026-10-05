"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReceiptIncidentEvidence } from "@/core/entities";
import type { ReceiptDraftTrackingDetailInput } from "@/core/repositories";
import { BackendRequestError } from "@/infrastructure/api/backendClient";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  CreateReceivingIncidentInput,
  ReceivingDocumentDetail,
  ReceivingDocumentIncident,
  ReceivingDocumentDetailType,
  ReceivingDocumentLine,
  ReceivingTrackingDetail,
} from "@/modules/receiving/application/dto/ReceivingDocumentDetailDto";
import { PurchaseOrderPdfService } from "@/modules/purchasing/application/services/PurchaseOrderPdfService";
import { ReceivingDocumentDetailService } from "@/modules/receiving/application/services/ReceivingDocumentDetailService";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import { toFiniteNumber, type NumericInputValue } from "@/shared/utils/numberInput";

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
      current.map((line) =>
        // Una linea con incidencia (abierta o resuelta) queda inmutable: el backend la conserva.
        line.id === lineId && !line.incidentProtected ? recalculateLine({ ...line, ...patch }) : line,
      ),
    );
  }, [updateDirty]);

  const apiMode = repositories.receivingDataSource === "api";

  const updateLineQuantity = useCallback(
    (lineId: string, value: NumericInputValue) => {
      updateDirty(true);
      setLines((current) =>
        current.map((line) => {
          if (line.id !== lineId || line.incidentProtected) return line;
          const next = { ...line, receivedNow: value };
          return recalculateLine(
            apiMode ? { ...next, trackingDetails: syncTrackingDetails(line, next) } : next,
          );
        }),
      );
    },
    [apiMode, updateDirty],
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
    async (
      input: Omit<CreateReceivingIncidentInput, "documentId" | "receiptId" | "goodsReceiptItemId"> & {
        /** PurchaseOrderItem estable; el GoodsReceiptItem real se resuelve tras persistir. */
        sourceLineId: string;
      },
    ) => {
      if (!detail) throw new Error("No se encontró la recepción.");
      if (incidentMutationPendingRef.current || mutationPendingRef.current) return;
      const mutationBranchId = activeBranchIdRef.current;
      incidentMutationPendingRef.current = true;
      setIncidentSaving(true);
      try {
        let receiptId = detail.document.receiptId;
        const { sourceLineId, ...incidentInput } = input;
        let goodsReceiptItemId = lines.find((line) => line.sourceLineId === sourceLineId)
          ?.goodsReceiptItemId;
        let didSave = false;
        if (dirtyRef.current || !receiptId) {
          // Se usa el receipt devuelto por el guardado, nunca el estado de React (puede estar viejo).
          const savedReceipt = await service.saveProgress({
            documentType,
            documentId,
            lines,
            incidents,
          });
          receiptId = savedReceipt.id;
          didSave = true;
        }
        if (didSave || !goodsReceiptItemId) {
          // El guardado reemplaza los items del borrador: se re-resuelve el GoodsReceiptItem real
          // desde el receipt canonico por sourceLineId (nunca ids previos al PUT).
          if (!mutationBranchId) throw new Error("Selecciona una sucursal activa.");
          const fresh = await service.getDocument(documentType, documentId, mutationBranchId);
          if (fresh.document.receiptId && fresh.document.receiptId !== receiptId) {
            throw new Error("El borrador cambió; vuelve a intentar.");
          }
          goodsReceiptItemId = fresh.lines.find(
            (line) => line.sourceLineId === sourceLineId,
          )?.goodsReceiptItemId;
        }
        if (!goodsReceiptItemId) {
          throw new Error(
            "Este producto aún no tiene cantidad recibida; ingresa una cantidad aceptada para registrar la incidencia.",
          );
        }
        await service.createIncident({
          documentId,
          receiptId,
          ...incidentInput,
          goodsReceiptItemId,
        });
        if (activeBranchIdRef.current !== mutationBranchId) return;
        await reload();
      } catch (caughtError) {
        throw toFriendlyIncidentError(caughtError);
      } finally {
        incidentMutationPendingRef.current = false;
        setIncidentSaving(false);
      }
    },
    [detail, documentId, documentType, incidents, lines, reload, service],
  );

  const draftReceiptId = detail?.document.receiptId;
  const branchName = detail?.document.branchName;
  const pdfService = useMemo(() => new PurchaseOrderPdfService(repositories), [repositories]);
  // Reporte final desde datos canonicos de la orden/recepciones confirmadas (sin API en el componente).
  const downloadFinalReport = useCallback(
    () => pdfService.downloadReceivingReport(documentId, { branchName }),
    [branchName, documentId, pdfService],
  );
  const resolveApiIncident = useCallback(
    async (incidentId: string, trackingDetails?: ReceiptDraftTrackingDetailInput[]) => {
      if (!draftReceiptId) {
        throw new Error("No se encontró el borrador asociado a la incidencia.");
      }
      if (incidentMutationPendingRef.current || mutationPendingRef.current) return;
      const mutationBranchId = activeBranchIdRef.current;
      incidentMutationPendingRef.current = true;
      setIncidentSaving(true);
      try {
        if (dirtyRef.current) {
          // Resolver relee el receipt: se persisten antes los cambios locales para no perderlos.
          await service.saveProgress({ documentType, documentId, lines, incidents });
        }
        await service.resolveIncident(
          documentId,
          draftReceiptId,
          incidentId,
          trackingDetails,
        );
        // Cantidades, incidencias y estado se releen del backend (fuente de verdad).
        if (activeBranchIdRef.current !== mutationBranchId) return;
        await reload();
      } catch (caughtError) {
        throw toFriendlyIncidentError(caughtError);
      } finally {
        incidentMutationPendingRef.current = false;
        setIncidentSaving(false);
      }
    },
    [draftReceiptId, documentId, documentType, incidents, lines, reload, service],
  );

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
    // En API el draft puede no existir aun: la pagina lo persiste (Guardar avance) antes de abrir
    // el formulario, nunca se crea una segunda recepcion porque saveApiDraft reutiliza el draft.
    incidentsAvailable:
      !apiMode || Boolean(apiPurchaseOrder && detail?.canManageIncidents),
    reload,
    updateLine,
    updateLineQuantity,
    saveProgress,
    confirm,
    saveIncident,
    removeIncident,
    createApiIncident,
    resolveApiIncident,
    downloadFinalReport,
  };
}

/** Traduce errores de backend conocidos a mensajes entendibles; conserva el resto. */
export function toFriendlyIncidentError(error: unknown): Error {
  if (error instanceof BackendRequestError) {
    if (error.code === "DUPLICATE_SERIAL") {
      return new Error("Uno o más números de serie ya están registrados. Revisa los seriales.");
    }
    if (error.status === 409) {
      return new Error("La información cambió. Actualiza la recepción e intenta nuevamente.");
    }
  }
  return error instanceof Error ? error : new Error("No se pudo completar la operación.");
}

function toAcceptedBaseQuantity(line: ReceivingDocumentLine) {
  const accepted = toFiniteNumber(line.receivedNow);
  return Math.max(0, Number((accepted * line.purchaseToBaseFactor).toFixed(6)));
}

/**
 * Mantiene el primer trackingDetail alineado con "Aceptado ahora" mientras el usuario no lo haya
 * tocado (sin lote/vencimiento/series y con la cantidad base autogenerada). Una vez que existen
 * varios detalles o el unico fue editado, la distribucion es del usuario y no se redistribuye.
 */
export function syncTrackingDetails(
  previous: ReceivingDocumentLine,
  next: ReceivingDocumentLine,
): ReceivingTrackingDetail[] {
  const details = next.trackingDetails;
  if (!next.tracking.lot && !next.tracking.serial) return details;
  if (typeof next.receivedNow !== "number" && next.receivedNow !== "") return details;
  const nextBase = toAcceptedBaseQuantity(next);
  if (details.length === 0) {
    if (nextBase <= 0) return details;
    return [
      {
        id: crypto.randomUUID(),
        baseQuantity: nextBase,
        lotNumber: "",
        expirationDate: "",
        serialNumbersText: "",
      },
    ];
  }
  const [only] = details;
  if (details.length !== 1 || !only) return details;
  const pristine =
    !only.lotNumber &&
    !only.expirationDate &&
    !only.serialNumbersText &&
    toFiniteNumber(only.baseQuantity) === toAcceptedBaseQuantity(previous);
  if (!pristine) return details;
  if (nextBase <= 0) return [];
  return [{ ...only, baseQuantity: nextBase }];
}

function recalculateLine(line: ReceivingDocumentLine) {
  const receivedNow = typeof line.receivedNow === "number" ? line.receivedNow : 0;
  return {
    ...line,
    pendingQuantity: Math.max(0, line.orderedQuantity - line.acceptedPreviously - receivedNow),
  };
}
