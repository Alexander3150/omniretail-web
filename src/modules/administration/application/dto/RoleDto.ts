import type { Role } from "@/core/entities";

export type RoleDto = Omit<Role, "tenantId">;

/**
 * `isSystem` nunca se acepta desde este DTO: lo define el seed/la plataforma, no el formulario de
 * alta. Un rol creado desde acá siempre nace con `isSystem: false` (ver CreateRoleService).
 */
export type RoleInputDto = Pick<Role, "name" | "description" | "permissions" | "branchScope" | "status">;
