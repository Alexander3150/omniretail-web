import { AccountStatus } from "@/core/enums";
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
  busy: boolean;
  onEdit: (employee: EmployeeDto) => void;
  onResendInvitation: (employee: EmployeeDto) => void;
}

/**
 * Estados en los que reintentar la invitación tiene sentido (ticket §1): sin cuenta todavía
 * (`authStatus` undefined -- p.ej. el alta creó el User pero `inviteEmployee` falló) o con una
 * invitación previa vencida/nunca aceptada (`password_reset_required`). Cualquier otro estado
 * (`active`, `temporarily_locked`, `disabled`, `archived`, `pending_verification`) ya lo rechaza
 * `AuthRepository.inviteEmployee` con su propio mensaje -- no tiene sentido ofrecer un botón que
 * siempre va a fallar, y así una cuenta `active` nunca puede reinvitarse por accidente desde acá.
 */
function canResendInvitation(authStatus: EmployeeDto["authStatus"]): boolean {
  return authStatus === undefined || authStatus === AccountStatus.password_reset_required;
}

export function EmployeeTable({
  employees,
  roleNames,
  branchNames,
  canManage,
  busy,
  onEdit,
  onResendInvitation,
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
          {canResendInvitation(employee.authStatus) ? (
            <Button
              className="min-h-9 px-3 py-1.5"
              disabled={busy}
              onClick={() => onResendInvitation(employee)}
              type="button"
              variant="ghost"
            >
              {employee.authStatus === AccountStatus.password_reset_required
                ? "Reenviar invitación"
                : "Enviar invitación"}
            </Button>
          ) : null}
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
