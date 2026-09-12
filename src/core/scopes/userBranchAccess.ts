import type { Role, User } from "@/core/entities";

export function canUserAccessBranch(user: User, role: Role, branchId: string): boolean {
  if (user.tenantId !== role.tenantId) return false;
  if (role.branchScope === "all") return true;
  if (role.branchScope === "selected") {
    return user.allowedBranchIds?.includes(branchId) ?? false;
  }
  return user.branchId === branchId;
}

export class BranchAccessDeniedError extends Error {
  constructor(branchId: string) {
    super(`No tenés acceso a esta sucursal (${branchId}).`);
    this.name = "BranchAccessDeniedError";
  }
}

/**
 * Variante que lanza para Application Services, misma semantica que
 * requireEmployeePermission (core/permissions/resolvePermission.ts).
 */
export function requireBranchAccess(user: User, role: Role, branchId: string): void {
  if (canUserAccessBranch(user, role, branchId)) return;
  throw new BranchAccessDeniedError(branchId);
}
