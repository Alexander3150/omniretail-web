import { permissionsConfig } from "@/config/permissions";
import { RoleStatus } from "@/core/enums";
import type { RoleInputDto } from "@/modules/administration/application/dto/RoleDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

/**
 * `archived` deliberadamente NO es un estado directamente asignable desde Create/Edit: solo
 * `ArchiveRoleService` (`archiveScoped`) puede llevar un rol a ese estado. Esto evita que alguien
 * archive/desarchive un rol pisando la auditoría y las invariantes propias de ese flujo (ver
 * ArchiveRoleService).
 */
const EDITABLE_STATUSES: readonly RoleStatus[] = [RoleStatus.active, RoleStatus.inactive];
/**
 * Catálogo completo de permisos válidos de toda la app (`src/config/permissions.ts`). Los
 * permisos de un rol nunca son texto libre: el formulario ofrece checkboxes sobre este mismo
 * catálogo, pero el service valida igual por si otro consumidor invoca con una key inventada.
 */
const VALID_PERMISSION_KEYS = new Set(permissionsConfig.map((permission) => permission.key));

/**
 * Valida el DTO recibido antes de normalizarlo. Una UI oculta no impide que otro consumidor
 * invoque el service con datos inválidos.
 */
export function validateRoleInput(dto: RoleInputDto) {
  if (!dto.name.trim()) {
    throw new AdministrationServiceError("El nombre del rol es obligatorio.");
  }
  if (!EDITABLE_STATUSES.includes(dto.status)) {
    throw new AdministrationServiceError(
      dto.status === RoleStatus.archived
        ? "Un rol no se archiva editando su estado: usá la acción Archivar."
        : "El estado del rol no es válido.",
    );
  }
  if (!Array.isArray(dto.permissions) || dto.permissions.length === 0) {
    throw new AdministrationServiceError("Seleccioná al menos un permiso para el rol.");
  }
  if (dto.permissions.some((key) => !VALID_PERMISSION_KEYS.has(key))) {
    throw new AdministrationServiceError("Alguno de los permisos seleccionados no es válido.");
  }
}

/**
 * Un actor solo puede otorgar permisos que él mismo posee -- nunca delegar más de lo que tiene
 * (`requestedPermissions ⊆ actorEffectivePermissions`). Se valida acá, en la capa de aplicación,
 * no en el checkbox: una llamada directa al service con `permissions` insuficientes debe fallar
 * igual. No hay excepción de "super admin"/"isSystem" -- no existe hoy un concepto autoritativo
 * de eso en el código (se buscó explícitamente, ver PR #88); inventar un bypass sería la brecha
 * de seguridad que esta regla existe para cerrar.
 */
export function ensureDelegatablePermissions(
  actorPermissions: readonly string[],
  requestedPermissions: readonly string[],
) {
  const actorPermissionSet = new Set(actorPermissions);
  const nonDelegable = requestedPermissions.filter((key) => !actorPermissionSet.has(key));
  if (nonDelegable.length > 0) {
    throw new AdministrationServiceError(
      `No podés otorgar permisos que vos mismo no tenés: ${nonDelegable.join(", ")}.`,
    );
  }
}

export function normalizeRoleInput(dto: RoleInputDto): RoleInputDto {
  return {
    name: dto.name.trim(),
    description: dto.description?.trim() || undefined,
    permissions: Array.from(new Set(dto.permissions)),
    status: dto.status,
  };
}
