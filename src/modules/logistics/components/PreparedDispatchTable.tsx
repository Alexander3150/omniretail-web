import type { PreparedOrderQueueItemDto } from "@/modules/logistics/application/dto/DispatchReadModelDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface PreparedDispatchTableProps {
  items: PreparedOrderQueueItemDto[];
  disabled?: boolean;
  onSelect: (item: PreparedOrderQueueItemDto) => void;
}

export function PreparedDispatchTable({ items, disabled, onSelect }: PreparedDispatchTableProps) {
  const columns: DataTableColumn<PreparedOrderQueueItemDto>[] = [
    { key: "order", header: "Pedido", cell: (item) => <span className="font-semibold text-[var(--color-title)]">{item.orderReference}</span> },
    { key: "recipient", header: "Destinatario", cell: (item) => <div><p>{item.recipientName || "Sin destinatario"}</p><p className="text-xs text-[var(--color-text-muted)]">{item.recipientPhone ?? "Sin teléfono"}</p></div> },
    { key: "address", header: "Entrega", cell: (item) => item.address ? `${item.address.line1}, ${item.address.city}` : "Sin dirección" },
    { key: "transport", header: "Transporte", cell: (item) => item.transportMode === "third_party" ? "Tercero" : "Flota propia" },
    { key: "status", header: "Estado", cell: () => <StatusBadge status="ready_for_dispatch" /> },
    { key: "action", header: "", className: "text-right", cell: (item) => <Button disabled={disabled} onClick={(event) => { event.stopPropagation(); onSelect(item); }} type="button" variant="secondary">Preparar despacho</Button> },
  ];

  return <DataTable columns={columns} data={items} emptyMessage="No hay pedidos preparados para despacho." onRowClick={onSelect} rowKey={(item) => item.orderId} />;
}
