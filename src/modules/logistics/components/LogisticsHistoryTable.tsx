import type { MouseEvent } from "react";
import { DeliveryMethod, OrderStatus } from "@/core/enums";
import type { LogisticsHistoryItemDto } from "@/modules/logistics/application/dto/LogisticsHistoryDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface LogisticsHistoryTableProps {
  items: LogisticsHistoryItemDto[];
  canConfirmDispatch: boolean;
  onAddGuide: (item: LogisticsHistoryItemDto) => void;
  onRowDoubleClick?: (item: LogisticsHistoryItemDto) => void;
}

export function LogisticsHistoryTable({
  items,
  canConfirmDispatch,
  onAddGuide,
  onRowDoubleClick,
}: LogisticsHistoryTableProps) {
  const showActionColumn = items.some(canAddGuide);
  const columns: DataTableColumn<LogisticsHistoryItemDto>[] = [
    {
      key: "document",
      header: "Documento",
      className: "w-[9%] px-2 py-2 align-top",
      cell: (item) => (
        <div className="min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Pedido</span>
          <strong className="block whitespace-nowrap text-sm text-[var(--color-title)]">
            {item.orderReference}
          </strong>
        </div>
      ),
    },
    {
      key: "orderCustomer",
      header: "Pedido / Cliente",
      className: "w-[17%] px-2 py-2 align-top",
      cell: (item) => (
        <div className="min-w-0 space-y-0.5">
          <strong className="block break-words text-sm text-[var(--color-title)]">{item.contactName}</strong>
          <span className="block text-xs text-[var(--color-text-muted)]">
            {item.deliveryMethod === DeliveryMethod.home_delivery
              ? "Envío a domicilio"
              : "Retiro en tienda/bodega"}
          </span>
        </div>
      ),
    },
    {
      key: "result",
      header: "Resultado",
      className: "w-[13%] px-2 py-2 align-top",
      cell: (item) => (
        <div className="whitespace-nowrap">
          <StatusBadge status={item.operationalStatus} />
        </div>
      ),
    },
    {
      key: "pickingCompleted",
      header: "Recolección finalizada",
      className: "w-[13%] px-2 py-2 align-top",
      cell: (item) => <span className="block text-sm leading-5">{formatDateTime(item.pickingCompletedAt)}</span>,
    },
    {
      key: "exit",
      header: "Salida",
      className: "w-[12%] px-2 py-2 align-top",
      cell: (item) => <ExitSummary item={item} />,
    },
    {
      key: "responsible",
      header: "Responsable",
      className: "w-[12%] px-2 py-2 align-top",
      cell: (item) => <span className="block break-words text-sm leading-5">{item.responsibleUserName ?? "—"}</span>,
    },
    {
      key: "package",
      header: "Paquete",
      className: "w-[10%] px-2 py-2 align-top",
      cell: (item) => <span className="block text-sm leading-5">{packageSummary(item)}</span>,
    },
  ];

  if (showActionColumn) {
    columns.push({
      key: "action",
      header: "Acción",
      className: "w-[14%] px-2 py-2 align-top",
      cell: (item) =>
        canAddGuide(item) ? (
          <Button
            className="min-h-9 whitespace-nowrap px-3 py-1.5"
            disabled={!canConfirmDispatch}
            title={canConfirmDispatch ? undefined : "No tienes permiso para confirmar despachos."}
            type="button"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onAddGuide(item);
            }}
            onDoubleClick={(event: MouseEvent<HTMLButtonElement>) => event.stopPropagation()}
          >
            + Agregar guía
          </Button>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      emptyMessage="No hay pedidos que coincidan con los filtros actuales."
      rowKey={(item) => item.orderId}
      onRowDoubleClick={onRowDoubleClick}
    />
  );
}

export function canAddGuide(item: LogisticsHistoryItemDto) {
  return (
    item.deliveryMethod === DeliveryMethod.home_delivery &&
    item.operationalStatus === OrderStatus.ready_for_dispatch &&
    item.packingId !== null &&
    item.packingFinalizedAt !== null &&
    item.dispatchId === null
  );
}

function ExitSummary({ item }: { item: LogisticsHistoryItemDto }) {
  const latestExitAt = item.deliveredAt ?? item.dispatchedAt ?? item.packingFinalizedAt;
  return <span className="block text-sm leading-5">{formatDateTime(latestExitAt)}</span>;
}

function packageSummary(item: LogisticsHistoryItemDto) {
  if (item.deliveryMethod === DeliveryMethod.store_pickup) return "No aplica";
  const parts: string[] = [];
  if (item.totalWeight !== null) parts.push(`${item.totalWeight} kg`);
  if (item.packageCount !== null) {
    parts.push(`${item.packageCount} ${item.packageCount === 1 ? "bulto" : "bultos"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
