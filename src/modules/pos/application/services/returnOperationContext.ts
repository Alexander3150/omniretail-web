import { BranchStatus, UserStatus, UserType } from "@/core/enums";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export interface ReturnOperationContext {
  tenantId: string;
  branchId: string;
  actorUserId: string;
}

export async function requireReturnOperationContext(
  repositories: Pick<RepositoryRegistry, "branches" | "roles" | "users">,
  context: ReturnOperationContext,
  permission: "pos.returns.read" | "pos.returns.create" | "pos.sales.void",
) {
  const tenantId = context.tenantId.trim();
  const branchId = context.branchId.trim();
  const actorUserId = context.actorUserId.trim();
  if (!tenantId || !branchId || !actorUserId) {
    throw new Error("No se pudo resolver el contexto operativo de devoluciones.");
  }
  const [user, branch] = await Promise.all([
    repositories.users.getById(actorUserId),
    repositories.branches.getById(branchId),
  ]);
  if (
    !user ||
    user.tenantId !== tenantId ||
    user.type !== UserType.employee ||
    user.status !== UserStatus.active
  ) {
    throw new Error("El usuario activo no es valido para este negocio.");
  }
  if (!branch || branch.tenantId !== tenantId || branch.status !== BranchStatus.active) {
    throw new Error("La sucursal no esta activa para este negocio.");
  }
  const role = user.roleId ? await repositories.roles.getById(user.roleId) : null;
  if (!role || role.tenantId !== tenantId || !role.permissions.includes(permission)) {
    throw new Error("No tienes permiso para realizar esta operacion.");
  }
  if (!canUserAccessBranch(user, role, branch.id)) {
    throw new Error("No tienes acceso a la sucursal seleccionada.");
  }
  return { tenantId, branchId, actorUserId, user, role, branch };
}
