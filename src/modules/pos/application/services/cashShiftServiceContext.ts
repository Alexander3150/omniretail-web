import type { Branch, Role, User } from "@/core/entities";
import { BranchStatus, UserStatus, UserType } from "@/core/enums";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export interface CashShiftOperationContext {
  tenantId: string;
  actorUserId: string;
  branchId: string;
}

type CashContextRepositories = Pick<RepositoryRegistry, "branches" | "roles" | "users">;

export interface ResolvedCashContext {
  branch: Branch;
  role: Role;
  user: User;
}

export async function requireCashContext(
  repositories: CashContextRepositories,
  context: CashShiftOperationContext,
  permission: string,
  requireActiveBranch = false,
): Promise<ResolvedCashContext> {
  if (!context.tenantId.trim() || !context.actorUserId.trim() || !context.branchId.trim()) {
    throw new Error("No se pudo resolver el contexto operativo de caja.");
  }

  const [user, branch] = await Promise.all([
    repositories.users.getById(context.actorUserId),
    repositories.branches.getById(context.branchId),
  ]);
  if (
    !user ||
    user.tenantId !== context.tenantId ||
    user.type !== UserType.employee ||
    user.status !== UserStatus.active
  ) {
    throw new Error("El usuario activo no es válido para este negocio.");
  }
  if (
    !branch ||
    branch.tenantId !== context.tenantId ||
    (requireActiveBranch && branch.status !== BranchStatus.active)
  ) {
    throw new Error("La sucursal no está disponible para este negocio.");
  }

  const role = user.roleId ? await repositories.roles.getById(user.roleId) : null;
  if (!role || role.tenantId !== context.tenantId || !role.permissions.includes(permission)) {
    throw new Error("No tienes permiso para realizar esta operación de caja.");
  }
  if (!canUserAccessBranch(user, role, branch.id)) {
    throw new Error("No tienes acceso a la sucursal seleccionada.");
  }

  return { branch, role, user };
}

export function assertOwnedCashShift(
  shift: { tenantId: string; branchId: string; userId: string } | null,
  context: CashShiftOperationContext,
): asserts shift is { tenantId: string; branchId: string; userId: string } {
  if (
    !shift ||
    shift.tenantId !== context.tenantId ||
    shift.branchId !== context.branchId ||
    shift.userId !== context.actorUserId
  ) {
    throw new Error("El turno de caja no está disponible para el contexto actual.");
  }
}
