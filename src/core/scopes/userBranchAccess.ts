import type { Role, User } from "@/core/entities";

export function canUserAccessBranch(user: User, role: Role, branchId: string): boolean {
  if (user.tenantId !== role.tenantId) return false;
  if (role.branchScope === "all") return true;
  if (role.branchScope === "selected") {
    return user.allowedBranchIds?.includes(branchId) ?? false;
  }
  return user.branchId === branchId;
}
