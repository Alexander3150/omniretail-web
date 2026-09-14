"use client";

import { useState } from "react";
import type { AuditLogDto } from "@/modules/administration/application/dto/AuditLogDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { Modal } from "@/shared/components/Modal";
import { formatDate } from "@/shared/utils/formatDate";

interface AuditLogTableProps {
  logs: AuditLogDto[];
  actorNames: ReadonlyMap<string, string>;
}

export function AuditLogTable({ logs, actorNames }: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);
  const columns: DataTableColumn<AuditLogDto>[] = [
    {
      key: "createdAt",
      header: "Fecha",
      cell: (log) => <span className="whitespace-nowrap">{formatDate(log.createdAt)}</span>,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (log) => getActorLabel(log.actorUserId, actorNames),
    },
    {
      key: "action",
      header: "Acción",
      cell: (log) => <span className="font-semibold text-[var(--color-title)]">{log.action}</span>,
    },
    {
      key: "entityType",
      header: "Entidad",
      cell: (log) => log.entityType,
    },
    {
      key: "entityId",
      header: "ID entidad",
      cell: (log) => log.entityId || "—",
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (log) => (
        <Button
          className="min-h-9 px-3 py-1.5"
          onClick={() => setSelectedLog(log)}
          type="button"
          variant="ghost"
        >
          Detalle
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={logs}
        emptyMessage="No hay registros de auditoría para los filtros actuales."
        rowKey={(log) => log.id}
      />

      <Modal
        onClose={() => setSelectedLog(null)}
        open={Boolean(selectedLog)}
        size="lg"
        subtitle="Registro de solo lectura"
        title="Detalle de auditoría"
      >
        {selectedLog ? (
          <div className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <DetailField label="ID" value={selectedLog.id} />
              <DetailField label="Fecha" value={formatDate(selectedLog.createdAt)} />
              <DetailField
                label="Actor"
                value={getActorLabel(selectedLog.actorUserId, actorNames)}
              />
              <DetailField label="ID del actor" value={selectedLog.actorUserId || "—"} />
              <DetailField label="Acción" value={selectedLog.action} />
              <DetailField label="Entidad" value={selectedLog.entityType} />
              <DetailField label="ID de entidad" value={selectedLog.entityId || "—"} />
            </dl>

            <div>
              <h3 className="text-sm font-semibold text-[var(--color-title)]">Metadata</h3>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-app-background)] p-4 text-xs text-[var(--color-text)]">
                {formatMetadata(selectedLog.metadata)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-all text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function getActorLabel(
  actorUserId: string | undefined,
  actorNames: ReadonlyMap<string, string>,
): string {
  if (!actorUserId) return "Sistema";
  return actorNames.get(actorUserId) ?? actorUserId;
}

function formatMetadata(metadata: AuditLogDto["metadata"]): string {
  if (!metadata) return "—";

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "No se pudo mostrar la metadata de este registro.";
  }
}
