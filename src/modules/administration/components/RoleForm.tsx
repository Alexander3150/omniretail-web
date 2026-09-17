"use client";

import { useMemo, useState, type FormEvent } from "react";
import { permissionsConfig } from "@/config/permissions";
import { statusesConfig } from "@/config/statuses";
import { RoleStatus } from "@/core/enums";
import type { RoleDto, RoleInputDto } from "@/modules/administration/application/dto/RoleDto";
import {
  groupPermissionsByModule,
  permissionModuleLabels,
} from "@/modules/administration/permissionModuleLabels";
import { ADMIN_FIELD_LIMITS } from "@/modules/administration/validation/adminFieldConstraints";
import { Button } from "@/shared/components/Button";
import { FormField } from "@/shared/components/FormField";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

/**
 * `archived` no es un estado asignable desde este formulario a propósito -- solo la acción
 * Archivar (`ArchiveRoleService`) puede llevar un rol ahí. Ver `role.validation.ts`.
 */
const statusOptions = [RoleStatus.active, RoleStatus.inactive];

interface RoleFormProps {
  role?: RoleDto;
  busy: boolean;
  /**
   * Permisos efectivos del actor actual -- determina qué checkboxes del catálogo puede marcar
   * (ticket "FIXES FOCALIZADOS" §2: `requestedPermissions ⊆ actorEffectivePermissions`). Es
   * únicamente UX: `ensureDelegatablePermissions` en el service sigue siendo quien realmente
   * aplica la regla, así que una llamada directa que se salte este formulario queda igual de
   * bloqueada.
   */
  actorPermissions: readonly string[];
  onCancel: () => void;
  onSubmit: (value: RoleInputDto) => Promise<void>;
}

export function RoleForm({ role, busy, actorPermissions, onCancel, onSubmit }: RoleFormProps) {
  const [value, setValue] = useState<RoleInputDto>(() => toRoleInput(role));

  const permissionsByModule = useMemo(() => groupPermissionsByModule(permissionsConfig), []);
  const actorPermissionSet = useMemo(() => new Set(actorPermissions), [actorPermissions]);

  function setField<Key extends keyof RoleInputDto>(key: Key, fieldValue: RoleInputDto[Key]) {
    setValue((current) => ({ ...current, [key]: fieldValue }));
  }

  function togglePermission(key: string, checked: boolean) {
    setValue((current) => {
      const next = new Set(current.permissions);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...current, permissions: [...next] };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="role-name" label="Nombre">
          <Input
            disabled={busy}
            id="role-name"
            maxLength={ADMIN_FIELD_LIMITS.role.name}
            onChange={(event) => setField("name", event.target.value)}
            required
            value={value.name}
          />
        </FormField>

        <FormField id="role-status" label="Estado">
          <Select
            disabled={busy}
            id="role-status"
            onChange={(event) => setField("status", event.target.value as RoleInputDto["status"])}
            value={value.status}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusesConfig[status]?.label ?? status}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField id="role-description" label="Descripción">
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-structure)] focus:ring-2 focus:ring-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          id="role-description"
          maxLength={ADMIN_FIELD_LIMITS.role.description}
          onChange={(event) => setField("description", event.target.value)}
          value={value.description ?? ""}
        />
      </FormField>

      <FormField
        hint="Los permisos no son texto libre: solo se pueden asignar los que ya existen en el catálogo de la app."
        id="role-permissions"
        label={`Permisos (${value.permissions.length} seleccionados)`}
      >
        <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-3">
          {permissionsByModule.map(([moduleKey, modulePermissions]) => (
            <div key={moduleKey}>
              <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                {permissionModuleLabels[moduleKey] ?? moduleKey}
              </p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {modulePermissions.map((permission) => {
                  const checked = value.permissions.includes(permission.key);
                  const delegable = actorPermissionSet.has(permission.key);
                  // Un permiso ya marcado siempre se puede desmarcar (reducir nunca es
                  // escalación) -- lo que se bloquea es agregar uno que el actor no tiene. Así,
                  // editar un rol que otro admin con más alcance dejó con permisos fuera del
                  // alcance actual del actor no queda en un callejón sin salida: se puede seguir
                  // guardando mientras no se agregue nada nuevo no delegable.
                  const disabled = busy || (!checked && !delegable);
                  return (
                    <label
                      className="flex items-start gap-2 text-sm text-[var(--color-text)]"
                      key={permission.key}
                      title={permission.description}
                    >
                      <input
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => togglePermission(permission.key, event.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        {permission.name}
                        {!delegable ? (
                          <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">
                            (No disponible para tu cuenta)
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </FormField>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Guardando..." : role ? "Guardar cambios" : "Crear rol"}
        </Button>
      </div>
    </form>
  );
}

function toRoleInput(role?: RoleDto): RoleInputDto {
  if (role) {
    return {
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
      status: role.status,
    };
  }

  return {
    name: "",
    description: "",
    permissions: [],
    status: RoleStatus.active,
  };
}
