"use client";

import { useMemo, useState } from "react";
import { statusesConfig } from "@/config/statuses";
import { CustomerStatus } from "@/core/enums";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { SearchInput } from "@/shared/components/SearchInput";
import { Select } from "@/shared/components/Select";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface CustomerTableProps {
  customers: CustomerDto[];
  canManage: boolean;
  onArchive: (customer: CustomerDto) => void;
  onEdit: (customer: CustomerDto) => void;
}

export function CustomerTable({ customers, canManage, onArchive, onEdit }: CustomerTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter(
      (customer) =>
        (status === "all" || customer.status === status) &&
        (!query ||
          [customer.code, customer.name, customer.email].some((value) =>
            value.toLowerCase().includes(query),
          )),
    );
  }, [customers, search, status]);

  const columns: DataTableColumn<CustomerDto>[] = [
    {
      key: "code",
      header: "Código",
      cell: (customer) => (
        <span className="font-semibold text-[var(--color-title)]">{customer.code}</span>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      cell: (customer) => <span className="text-[var(--color-text)]">{customer.name}</span>,
    },
    {
      key: "email",
      header: "Correo electrónico",
      cell: (customer) => <span className="text-[var(--color-text)]">{customer.email}</span>,
    },
    {
      key: "segment",
      header: "Segmento",
      cell: () => "—",
    },
    {
      key: "registration",
      header: "Registro",
      cell: (customer) => (customer.userId !== undefined ? "Con cuenta" : "Comercial"),
    },
    {
      key: "status",
      header: "Estado",
      cell: (customer) => <StatusBadge status={customer.status} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (customer) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="min-h-9 px-3 py-1.5"
            onClick={() => onEdit(customer)}
            type="button"
            variant="ghost"
          >
            Editar
          </Button>
          {customer.status !== CustomerStatus.archived ? (
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onArchive(customer)}
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
    <div className="space-y-4">
      <section className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_14rem]">
        <SearchInput
          aria-label="Buscar clientes"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código, nombre o correo"
          value={search}
        />
        <Select
          aria-label="Filtrar clientes por estado"
          onChange={(event) => setStatus(event.target.value as CustomerStatus | "all")}
          value={status}
        >
          <option value="all">Todos los estados</option>
          {Object.values(CustomerStatus).map((option) => (
            <option key={option} value={option}>
              {statusesConfig[option]?.label ?? option}
            </option>
          ))}
        </Select>
      </section>

      <DataTable
        columns={columns}
        data={filteredCustomers}
        emptyMessage="No hay clientes para los filtros actuales."
        rowKey={(customer) => customer.id}
      />
    </div>
  );
}
