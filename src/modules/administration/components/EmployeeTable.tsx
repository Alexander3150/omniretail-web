import type { EmployeeDto } from "@/modules/administration/application/dto/EmployeeDto";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/formatDate";

interface EmployeeTableProps {
  employees: EmployeeDto[];
  roleNames: ReadonlyMap<string, string>;
  branchNames: ReadonlyMap<string, string>;
  canManage: boolean;
  onEdit: (employee: EmployeeDto) => void;
}

export function EmployeeTable({
  employees,
  roleNames,
  branchNames,
  canManage,
  onEdit,
}: EmployeeTableProps) {
  const columns: DataTableColumn<EmployeeDto>[] = [
    {
      key: "name",
      header: "Empleado",
      cell: (employee) => (
        <div>
          <span className="font-semibold text-[var(--color-title)]">{employee.name}</span>
          {employee.employeeCode ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{employee.employeeCode}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "email",
      header: "Correo electrónico",
      cell: (employee) => <span className="text-[var(--color-text)]">{employee.email}</span>,
    },
    {
      key: "role",
      header: "Rol",
      cell: (employee) => (
        <span className="text-[var(--color-text)]">
          {employee.roleId ? (roleNames.get(employee.roleId) ?? employee.roleId) : "Sin rol"}
        </span>
      ),
    },
    {
      key: "branches",
      header: "Sucursales",
      cell: (employee) => {
        const names = employee.allowedBranchIds.map((id) => branchNames.get(id) ?? id);
        return (
          <span className="text-[var(--color-text)]">
            {names.length > 0 ? names.join(", ") : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Estado empleado",
      cell: (employee) => <StatusBadge status={employee.status} />,
    },
    {
      key: "authStatus",
      header: "Estado cuenta",
      cell: (employee) =>
        employee.authStatus ? (
          <StatusBadge status={employee.authStatus} />
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">Sin cuenta</span>
        ),
    },
    {
      key: "mfa",
      header: "MFA",
      cell: (employee) => (
        <StatusBadge
          status={employee.mfaEnabled ? "Activo" : "Inactivo"}
          tone={employee.mfaEnabled ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "lastLoginAt",
      header: "Último acceso",
      cell: (employee) => (
        <span className="text-[var(--color-text)]">
          {employee.lastLoginAt ? formatDate(employee.lastLoginAt) : "Nunca"}
        </span>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (employee) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="min-h-9 px-3 py-1.5"
            onClick={() => onEdit(employee)}
            type="button"
            variant="ghost"
          >
            Editar
          </Button>
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={employees}
      emptyMessage="Aún no hay empleados registrados."
      rowKey={(employee) => employee.id}
    />
  );
}
