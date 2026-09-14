import { permissionsConfig } from "@/config/permissions";
import type { BranchScope } from "@/core/entities";
import type { RoleInputDto } from "@/modules/administration/application/dto/RoleDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const BRANCH_SCOPES: readonly BranchScope[] = ["assigned", "selected", "all"];
const STATUSES: readonly string[] = ["active", "inactive", "archived"];
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
  if (!BRANCH_SCOPES.includes(dto.branchScope)) {
    throw new AdministrationServiceError("El alcance de sucursal no es válido.");
  }
  if (!STATUSES.includes(dto.status)) {
    throw new AdministrationServiceError("El estado del rol no es válido.");
  }
  if (!Array.isArray(dto.permissions) || dto.permissions.length === 0) {
    throw new AdministrationServiceError("Seleccioná al menos un permiso para el rol.");
  }
  if (dto.permissions.some((key) => !VALID_PERMISSION_KEYS.has(key))) {
    throw new AdministrationServiceError("Alguno de los permisos seleccionados no es válido.");
  }
}

export function normalizeRoleInput(dto: RoleInputDto): RoleInputDto {
  return {
    name: dto.name.trim(),
    description: dto.description?.trim() || undefined,
    permissions: Array.from(new Set(dto.permissions)),
    branchScope: dto.branchScope,
    status: dto.status,
  };
}
