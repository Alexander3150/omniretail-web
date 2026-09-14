"use client";

import { useState } from "react";
import { permissionsConfig } from "@/config/permissions";
import type { BranchScope } from "@/core/entities";
import type { RoleDto } from "@/modules/administration/application/dto/RoleDto";
import {
  groupPermissionsByModule,
  permissionModuleLabels,
} from "@/modules/administration/permissionModuleLabels";
import { Button } from "@/shared/components/Button";
import { DataTable, type DataTableColumn } from "@/shared/components/DataTable";
import { Modal } from "@/shared/components/Modal";
import { StatusBadge } from "@/shared/components/StatusBadge";

const branchScopeLabels: Record<BranchScope, string> = {
  assigned: "Sucursal asignada",
  selected: "Sucursales seleccionadas",
  all: "Todas las sucursales",
};

interface RoleTableProps {
  roles: RoleDto[];
  canManage: boolean;
  onArchive: (role: RoleDto) => void;
  onEdit: (role: RoleDto) => void;
}

export function RoleTable({ roles, canManage, onArchive, onEdit }: RoleTableProps) {
  const [viewedRole, setViewedRole] = useState<RoleDto | null>(null);

  const columns: DataTableColumn<RoleDto>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (role) => (
        <div>
          <span className="font-semibold text-[var(--color-title)]">{role.name}</span>
          {role.isSystem ? (
            <span className="ml-2 rounded-full bg-[var(--color-app-background)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
              Sistema
            </span>
          ) : null}
          {role.description ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{role.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "branchScope",
      header: "Alcance",
      cell: (role) => (
        <span className="text-[var(--color-text)]">{branchScopeLabels[role.branchScope]}</span>
      ),
    },
    {
      key: "permissions",
      header: "Permisos",
      cell: (role) => (
        <Button
          className="min-h-8 px-3 py-1.5 text-xs"
          onClick={() => setViewedRole(role)}
          type="button"
          variant="ghost"
        >
          Ver permisos ({role.permissions.length})
        </Button>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (role) => <StatusBadge status={role.status} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (role) => {
        if (role.isSystem) {
          return <span className="text-xs text-[var(--color-text-muted)]">Protegido</span>;
        }
        // Un rol archivado no se reabre por acá: Create/Edit ya no puede representar "archived"
        // como estado (ver role.validation.ts), así que reactivar un rol no es un flujo soportado
        // desde esta pantalla todavía.
        if (role.status === "archived") {
          return <span className="text-xs text-[var(--color-text-muted)]">Archivado</span>;
        }
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onEdit(role)}
              type="button"
              variant="ghost"
            >
              Editar
            </Button>
            <Button
              className="min-h-9 px-3 py-1.5"
              onClick={() => onArchive(role)}
              type="button"
              variant="danger"
            >
              Archivar
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={roles}
        emptyMessage="Aún no hay roles registrados."
        rowKey={(role) => role.id}
      />
      <RoleDetailModal onClose={() => setViewedRole(null)} role={viewedRole} />
    </>
  );
}

function RoleDetailModal({ role, onClose }: { role: RoleDto | null; onClose: () => void }) {
  const rolePermissions = role
    ? permissionsConfig.filter((permission) => role.permissions.includes(permission.key))
    : [];
  const permissionsByModule = groupPermissionsByModule(rolePermissions);

  return (
    <Modal
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose} type="button" variant="secondary">
            Cerrar
          </Button>
        </div>
      }
      onClose={onClose}
      open={Boolean(role)}
      size="lg"
      subtitle={role ? branchScopeLabels[role.branchScope] : undefined}
      title={role ? `Permisos de ${role.name}` : "Permisos del rol"}
    >
      {role ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={role.status} />
            {role.isSystem ? (
              <span className="rounded-full bg-[var(--color-app-background)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                Rol de sistema — protegido, no editable
              </span>
            ) : null}
          </div>

          {role.description ? (
            <p className="text-sm text-[var(--color-text-muted)]">{role.description}</p>
          ) : null}

          {rolePermissions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Este rol no tiene permisos asignados.
            </p>
          ) : (
            <div className="space-y-4">
              {permissionsByModule.map(([moduleKey, modulePermissions]) => (
                <div key={moduleKey}>
                  <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                    {permissionModuleLabels[moduleKey] ?? moduleKey}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {modulePermissions.map((permission) => (
                      <li
                        className="text-sm text-[var(--color-text)]"
                        key={permission.key}
                        title={permission.description}
                      >
                        {permission.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
