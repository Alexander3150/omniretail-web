"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReceiptIncidentEvidence } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
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
  const [error, setError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState(() => crypto.randomUUID());

  const reload = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const nextDetail = await service.getDocument(documentType, documentId, activeBranchId);
      setDetail(nextDetail);
      setLines(nextDetail.lines);
      setIncidents(nextDetail.incidents);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, documentId, documentType, service]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  useDataEvent("receipt.changed", reload);
  useDataEvent("purchase-order.changed", reload);
  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("incident-type.changed", reload);
  useDataEvent("unit-conversion.changed", reload);
  useDataEvent("supplier-product.changed", reload);
  useDataEvent("business-config.changed", reload);

  const updateLine = useCallback((lineId: string, patch: Partial<ReceivingDocumentLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? recalculateLine({ ...line, ...patch }) : line)),
    );
  }, []);

  const updateLineQuantity = useCallback(
    (lineId: string, value: NumericInputValue) => {
      updateLine(lineId, { receivedNow: value });
    },
    [updateLine],
  );

  const saveProgress = useCallback(async () => {
    setSaving(true);
    try {
      await service.saveProgress({
        documentType,
        documentId,
        userId: currentBranch ? "user-warehouse" : undefined,
        lines,
        incidents,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }, [currentBranch, documentId, documentType, incidents, lines, reload, service]);

  const confirm = useCallback(async () => {
    setSaving(true);
    try {
      await service.confirm({
        documentType,
        documentId,
        userId: currentBranch ? "user-warehouse" : undefined,
        lines,
        incidents,
        confirmationId,
      });
      await reload();
      setConfirmationId(crypto.randomUUID());
    } finally {
      setSaving(false);
    }
  }, [confirmationId, currentBranch, documentId, documentType, incidents, lines, reload, service]);

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
    },
    [detail, incidents, lines],
  );

  const removeIncident = useCallback(
    (incidentId: string) => {
      const nextIncidents = incidents.filter(
        (incident) => incident.id !== incidentId || !incident.editable,
      );
      setIncidents(nextIncidents);
      setLines((current) => current.map((item) => recalculateLine(item)));
    },
    [incidents],
  );

  return {
    detail,
    lines,
    incidents,
    currentBranch,
    loading: branchLoading || loading,
    saving,
    error,
    reload,
    updateLine,
    updateLineQuantity,
    saveProgress,
    confirm,
    saveIncident,
    removeIncident,
  };
}

function recalculateLine(line: ReceivingDocumentLine) {
  const receivedNow = typeof line.receivedNow === "number" ? line.receivedNow : 0;
  return {
    ...line,
    pendingQuantity: Math.max(0, line.orderedQuantity - line.acceptedPreviously - receivedNow),
  };
}
