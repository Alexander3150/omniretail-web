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
