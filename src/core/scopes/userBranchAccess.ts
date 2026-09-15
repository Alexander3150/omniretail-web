import type { Branch, Role, User } from "@/core/entities";

export function isBranchIdInUserScope(user: User, role: Role, branchId: string): boolean {
  if (user.tenantId !== role.tenantId) return false;
  if (role.branchScope === "all") return true;
  if (role.branchScope === "selected") {
    return user.allowedBranchIds?.includes(branchId) ?? false;
  }
  return user.branchId === branchId;
}

export function canUserAccessBranch(
  user: User,
  role: Role,
  branch: Pick<Branch, "id" | "tenantId">,
): boolean {
  return branch.tenantId === user.tenantId && isBranchIdInUserScope(user, role, branch.id);
}

/**
 * Fuente autoritativa para el alcance OPERATIVO de sucursales de un User (selector de
 * sucursal activa en el header). A diferencia de isBranchIdInUserScope/canUserAccessBranch
 * (legacy, Role.branchScope-driven, todavia consumido por POS/Logistics/Cash fuera de este
 * fix -- ver esos usos), esta funcion depende UNICAMENTE de User.allowedBranchIds: un
 * Role.branchScope="all" ya no otorga acceso implicito a "todas las sucursales" aca.
 *
 * User.branchId (legacy, un solo valor) se usa como fallback SOLO cuando allowedBranchIds
 * es undefined (campo nunca seteado -- cuentas semilla/legacy). Un allowedBranchIds definido
 * pero vacio ([]) significa "cero sucursales" a proposito y NO cae al fallback -- un User dado
 * de alta por CreateEmployeeService siempre setea allowedBranchIds (nunca branchId), asi que
 * el fallback nunca se activa para altas nuevas.
 */
export function resolveUserAllowedBranchIds(user: User): string[] {
  if (user.allowedBranchIds !== undefined) return user.allowedBranchIds;
  return user.branchId ? [user.branchId] : [];
}

export function isBranchIdInUserAllowedScope(user: User, branchId: string): boolean {
  return resolveUserAllowedBranchIds(user).includes(branchId);
}

export function canUserOperateBranch(
  user: User,
  branch: Pick<Branch, "id" | "tenantId">,
): boolean {
  return branch.tenantId === user.tenantId && isBranchIdInUserAllowedScope(user, branch.id);
}
