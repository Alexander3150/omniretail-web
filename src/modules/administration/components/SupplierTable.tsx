import type { SupplierDto } from "@/modules/administration/application/dto/SupplierDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface SupplierTableProps {
  suppliers: SupplierDto[];
  canManage: boolean;
  onArchive: (supplier: SupplierDto) => void;
  onEdit: (supplier: SupplierDto) => void;
}

export function SupplierTable({ suppliers, canManage, onArchive, onEdit }: SupplierTableProps) {
  const columns: DataTableColumn<SupplierDto>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (supplier) => (
        <span className="font-semibold text-[var(--color-title)]">{supplier.name}</span>
      ),
    },
    {
      key: "taxId",
      header: "Identificación tributaria",
      cell: (supplier) => <span className="text-[var(--color-text)]">{supplier.taxId || "—"}</span>,
    },
    {
      key: "email",
      header: "Correo electrónico",
      cell: (supplier) => <span className="text-[var(--color-text)]">{supplier.email || "—"}</span>,
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (supplier) => <span className="text-[var(--color-text)]">{supplier.phone || "—"}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (supplier) => <StatusBadge status={supplier.status} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (supplier) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="min-h-9 px-3 py-1.5"
            onClick={() => onEdit(supplier)}
            type="button"
            variant="ghost"
          >
            Editar
          </Button>
          {supplier.status !== "archived" ? (
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onArchive(supplier)}
              type="button"
              variant="danger"
            >
              Archivar
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={suppliers}
      emptyMessage="Aún no hay proveedores registrados."
      rowKey={(supplier) => supplier.id}
    />
  );
}
