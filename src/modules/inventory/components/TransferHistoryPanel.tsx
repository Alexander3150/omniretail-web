"use client";

import { useRef, useState } from "react";
import type { InventoryTransfer } from "@/core/entities";
import { InventoryTransferStatus } from "@/core/enums";
import type { TransferHistoryRow } from "@/modules/inventory/application/services/GetInventoryTransferHistoryService";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Input } from "@/shared/components/Input";
import { useToast } from "@/shared/components/Toast";

const STATUS_LABELS: Record<InventoryTransferStatus, string> = {
  [InventoryTransferStatus.preparing]: "En preparación",
  [InventoryTransferStatus.inTransit]: "En tránsito",
  [InventoryTransferStatus.received]: "Recibido / completado",
  [InventoryTransferStatus.cancelled]: "Cancelado",
};

interface Props {
  rows: TransferHistoryRow[];
  loading: boolean;
  error: string | null;
  canManageTransfers: boolean;
  busy: boolean;
  onCancel: (id: string, reason: string, operationId: string) => Promise<InventoryTransfer>;
  onConfirmationChange?: (open: boolean) => void;
}

export function TransferHistoryPanel({ rows, loading, error, canManageTransfers, busy,
  onCancel, onConfirmationChange }: Props) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const operationId = useRef<string | null>(null);
  const submitting = useRef(false);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function updateConfirmOpen(open: boolean) {
    setConfirmOpen(open);
    onConfirmationChange?.(open);
  }

  function select(row: TransferHistoryRow) {
    if (busy || submitting.current) return;
    setSelectedId(row.id);
    setReason("");
    setSubmitError("");
    updateConfirmOpen(false);
    operationId.current = null;
  }

  async function confirmCancel() {
    if (!selected || !selected.canCancel || !canManageTransfers || busy || submitting.current) return;
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setSubmitError("Ingresa el motivo de cancelación.");
      updateConfirmOpen(false);
      return;
    }
    submitting.current = true;
    setSubmitError("");
    try {
      const transfer = await onCancel(selected.id, normalizedReason,
        operationId.current ??= crypto.randomUUID());
      updateConfirmOpen(false);
      setReason("");
      operationId.current = null;
      showToast({ title: `Traslado ${transfer.number} cancelado`, tone: "success" });
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "No se pudo cancelar el traslado.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-[var(--color-title)]">Traslados materializados</h3>
      </div>
      {error ? <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--color-text-muted)]">Cargando traslados...</p> : null}
      {!loading && rows.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">No hay traslados para esta sucursal.</p> : null}
      {!loading && rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <article className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm" key={row.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[var(--color-title)]">{row.number}</p>
                  <p>{row.sourceBranchName} → {row.destinationBranchName}</p>
                  <p className="text-[var(--color-text-muted)]">Cantidad: {row.requestedQuantity} · {STATUS_LABELS[row.status]} · {formatDate(row.updatedAt)}</p>
                </div>
                <Button onClick={() => select(row)} type="button" variant="secondary">Ver detalle</Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {selected ? (
        <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
          <div>
            <h3 className="font-bold text-[var(--color-title)]">{selected.number} · {STATUS_LABELS[selected.status]}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{selected.sourceBranchName} → {selected.destinationBranchName}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-title)]">Ciclo de vida</h4>
              <ol className="mt-1 space-y-1 text-sm">
                {selected.lifecycle.map((step, index) => (
                  <li key={`${step.label}-${index}`}>{step.label} · {formatDate(step.at)}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-title)]">Movimientos físicos</h4>
              {selected.movements.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Sin Transfer Out / Transfer In registrado.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {selected.movements.map((movement) => (
                    <li key={movement.id}>{movement.label} · {movement.quantity} · {movement.branchName} · {formatDate(movement.at)} · {movement.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {selected.canCancel && canManageTransfers ? (
            <div className="max-w-lg space-y-2 border-t border-[var(--color-border)] pt-3">
              <label className="block text-sm font-semibold" htmlFor="transfer-cancel-reason">Motivo de cancelación *</label>
              <Input id="transfer-cancel-reason" maxLength={300} onChange={(event) => {
                setReason(event.target.value);
                setSubmitError("");
                operationId.current = null;
              }} value={reason} />
              {submitError ? <p className="text-sm text-[var(--color-danger)]" role="alert">{submitError}</p> : null}
              <Button disabled={busy || !reason.trim()} onClick={() => {
                operationId.current = crypto.randomUUID();
                updateConfirmOpen(true);
              }} type="button" variant="danger">Cancelar traslado</Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        cancelLabel="Volver"
        confirmLabel={busy ? "Cancelando..." : "Confirmar cancelación"}
        message={`¿Cancelar ${selected?.number ?? "este traslado"}? Se liberará su reserva en origen. Esta acción solo está disponible antes del despacho.`}
        onCancel={() => { if (!busy && !submitting.current) updateConfirmOpen(false); }}
        onConfirm={() => { void confirmCancel(); }}
        open={confirmOpen && Boolean(selected?.canCancel) && canManageTransfers}
        title="Cancelar traslado"
      />
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" })
    .format(new Date(value));
}
