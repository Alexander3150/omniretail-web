"use client";

import { useRef, useState } from "react";
import type { InventoryTransfer } from "@/core/entities";
import { InventoryTransferReason, InventoryTransferRequestStatus, InventoryTransferStatus } from "@/core/enums";
import type { ProductTransferRequestRow } from "@/modules/inventory/application/services/GetInventoryProductTransfersService";
import { TransferHistoryPanel } from "@/modules/inventory/components/TransferHistoryPanel";
import { useInventoryProductTransfers } from "@/modules/inventory/hooks/useInventoryProductTransfers";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Modal } from "@/shared/components/Modal";
import { useToast } from "@/shared/components/Toast";

type ViewFilter = "all" | "pending" | "progress" | "finished";
const REASONS: Record<InventoryTransferReason, string> = {
  [InventoryTransferReason.replenishment]: "Reposición de inventario",
  [InventoryTransferReason.demandCoverage]: "Cobertura de demanda",
  [InventoryTransferReason.urgentRequest]: "Solicitud urgente",
  [InventoryTransferReason.inventoryBalancing]: "Balanceo entre sucursales",
  [InventoryTransferReason.other]: "Otro",
};
const REQUEST_STATUS: Record<InventoryTransferRequestStatus, string> = {
  [InventoryTransferRequestStatus.requested]: "Pendiente de revisión",
  [InventoryTransferRequestStatus.approved]: "Aprobada",
  [InventoryTransferRequestStatus.rejected]: "Rechazada",
  [InventoryTransferRequestStatus.cancelled]: "Cancelada",
  [InventoryTransferRequestStatus.inTransit]: "En tránsito (legacy)",
  [InventoryTransferRequestStatus.received]: "Recibida (legacy)",
};

interface Props {
  branchId: string;
  productId: string;
  productName: string;
  busy: boolean;
  canManageTransfers: boolean;
  onClose: () => void;
  onReview: (requestId: string) => void;
  onCancelRequest: (requestId: string) => Promise<void>;
  onCancelTransfer: (id: string, reason: string, operationId: string) => Promise<InventoryTransfer>;
}

export function InventoryProductTransfersModal({ branchId, productId, productName, busy,
  canManageTransfers, onClose, onReview, onCancelRequest, onCancelTransfer }: Props) {
  const { data, error, loading } = useInventoryProductTransfers(branchId, productId);
  const { showToast } = useToast();
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const submitting = useRef(false);
  const transferById = new Map(data?.transfers.map((transfer) => [transfer.id, transfer]) ?? []);
  const requests = (data?.requests ?? []).filter((request) => {
    const linkedStatus = request.linkedTransferId
      ? transferById.get(request.linkedTransferId)?.status : undefined;
    if (linkedStatus) return matchesTransferFilter(linkedStatus, filter);
    if (filter === "all") return true;
    if (filter === "pending") return request.status === InventoryTransferRequestStatus.requested;
    if (filter === "progress") return request.status === InventoryTransferRequestStatus.approved ||
      request.status === InventoryTransferRequestStatus.inTransit;
    return request.status === InventoryTransferRequestStatus.rejected ||
      request.status === InventoryTransferRequestStatus.cancelled ||
      request.status === InventoryTransferRequestStatus.received;
  });
  const transfers = (data?.transfers ?? []).filter((transfer) =>
    matchesTransferFilter(transfer.status, filter));

  async function confirmCancelRequest() {
    if (!cancelRequestId || busy || submitting.current) return;
    submitting.current = true;
    setCancelError("");
    try {
      await onCancelRequest(cancelRequestId);
      setCancelRequestId(null);
      showToast({ title: "Solicitud cancelada", tone: "success" });
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : "No se pudo cancelar la solicitud.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <Modal open title="Solicitudes y traslados" subtitle={productName}
        maxWidth="850px" onClose={() => {
          if (!cancelRequestId && !transferConfirmOpen && !busy && !submitting.current) onClose();
        }}>
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2" aria-label="Filtrar solicitudes y traslados">
            {([ ["all", "Todos"], ["pending", "Pendientes"],
              ["progress", "En proceso"], ["finished", "Finalizados"] ] as const)
              .map(([value, label]) => (
                <Button key={value} onClick={() => setFilter(value)} type="button"
                  variant={filter === value ? "primary" : "secondary"}>{label}</Button>
              ))}
          </div>
          {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          {loading ? <p className="text-sm text-[var(--color-text-muted)]">Cargando solicitudes y traslados...</p> : null}
          {!loading && !error && requests.length === 0 && transfers.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No hay solicitudes ni traslados para este producto.</p>
          ) : null}
          {requests.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-base font-bold text-[var(--color-title)]">Solicitudes</h3>
              {requests.map((request) => (
                <RequestCard key={request.id} request={request} busy={busy}
                  canManageTransfers={canManageTransfers}
                  onCancel={() => { setCancelError(""); setCancelRequestId(request.id); }}
                  onReview={() => onReview(request.id)} />
              ))}
            </section>
          ) : null}
          <TransferHistoryPanel rows={transfers} loading={loading} error={null}
            busy={busy} canManageTransfers={canManageTransfers} onCancel={onCancelTransfer}
            onConfirmationChange={setTransferConfirmOpen} />
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(cancelRequestId)} title="Cancelar solicitud"
        message="¿Retirar esta solicitud pendiente? No se creará ningún traslado."
        confirmLabel={busy ? "Cancelando..." : "Cancelar solicitud"} cancelLabel="Volver"
        onCancel={() => { if (!busy && !submitting.current) setCancelRequestId(null); }}
        onConfirm={() => { void confirmCancelRequest(); }} />
      {cancelError ? <p role="alert" className="fixed bottom-4 right-4 z-[60] rounded-md bg-white p-3 text-sm text-[var(--color-danger)] shadow-lg">{cancelError}</p> : null}
    </>
  );
}

function RequestCard({ request, busy, canManageTransfers, onCancel, onReview }: {
  request: ProductTransferRequestRow;
  busy: boolean;
  canManageTransfers: boolean;
  onCancel: () => void;
  onReview: () => void;
}) {
  return (
    <article className="space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[var(--color-title)]">Solicitud de traslado · {REQUEST_STATUS[request.status]}</p>
          <p>{request.sourceBranchName} → {request.destinationBranchName}</p>
        </div>
        {request.linkedTransferNumber ? (
          <span className="rounded-md bg-[var(--color-app-background)] px-2 py-1 font-semibold">{request.linkedTransferNumber}</span>
        ) : null}
      </div>
      <p>Cantidad: {request.requestedQuantity} · Motivo: {REASONS[request.reason]}</p>
      <p className="text-[var(--color-text-muted)]">Solicitada: {formatDate(request.requestedAt)}</p>
      {request.notes ? <p>Observaciones: {request.notes}</p> : null}
      {request.rejectionReason ? <p>Motivo del rechazo: {request.rejectionReason}</p> : null}
      {request.cancellationReason ? <p>Motivo de cancelación: {request.cancellationReason}</p> : null}
      {canManageTransfers && (request.canCancel || request.canReview) ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {request.canCancel ? <Button disabled={busy} onClick={onCancel} type="button" variant="danger">Cancelar solicitud</Button> : null}
          {request.canReview ? <Button disabled={busy} onClick={onReview} type="button" variant="secondary">Revisar solicitud</Button> : null}
        </div>
      ) : null}
    </article>
  );
}

function matchesTransferFilter(status: InventoryTransferStatus, filter: ViewFilter) {
  if (filter === "all") return true;
  if (filter === "pending") return false;
  if (filter === "progress") return status === InventoryTransferStatus.preparing ||
    status === InventoryTransferStatus.inTransit;
  return status === InventoryTransferStatus.received || status === InventoryTransferStatus.cancelled;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" })
    .format(new Date(value));
}
