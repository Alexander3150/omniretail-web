import type { Branch, CashShift, Role, Tenant, User } from "@/core/entities";
import { BranchStatus, CashShiftStatus, SaasCapabilityKey } from "@/core/enums";
import { canUserOperateBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { resolveCurrentSessionSnapshot } from "@/modules/auth/application/services/resolveCurrentSessionSnapshot";
import { ensureTenantCapability } from "@/shared/application/services/entitlementGuards";
import { ResolveTenantEntitlementsService } from "@/shared/application/services/ResolveTenantEntitlementsService";

export const POS_SALES_CREATE_PERMISSION = "pos.sales.create";

export class PosServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PosServiceError";
  }
}

export interface PosSessionContext {
  tenant: Tenant;
  tenantId: string;
  actorUserId: string;
  user: User;
  role: Role;
  permissions: readonly string[];
}

export async function resolvePosSessionContext(
  repositories: Pick<RepositoryRegistry, "auth" | "roles" | "tenants" | "users">,
): Promise<PosSessionContext> {
  const snapshot = await resolveCurrentSessionSnapshot(repositories);
  if (!snapshot.user || !snapshot.role) {
    throw new PosServiceError(snapshot.error ?? "No existe una sesión activa.");
  }
  const tenant = await repositories.tenants.getById(snapshot.user.tenantId);
  if (!tenant) throw new PosServiceError("No se pudo resolver el negocio activo.");
  return {
    tenant,
    tenantId: snapshot.user.tenantId,
    actorUserId: snapshot.user.id,
    user: snapshot.user,
    role: snapshot.role,
    permissions: snapshot.role.permissions,
  };
}

export function ensurePosPermission(permissions: readonly string[], permission: string) {
  if (permissions.includes(permission)) return;
  throw new PosServiceError("No tienes permiso para crear ventas POS.");
}

export async function ensurePosBranchAccess(
  repositories: Pick<RepositoryRegistry, "branches">,
  user: User,
  branchId: string,
): Promise<Branch> {
  const branch = await repositories.branches.getById(branchId);
  if (!branch || branch.tenantId !== user.tenantId || branch.status !== BranchStatus.active) {
    throw new PosServiceError("La sucursal no está disponible para este negocio.");
  }
  if (!canUserOperateBranch(user, branch)) {
    throw new PosServiceError("No tienes acceso a la sucursal seleccionada.");
  }
  return branch;
}

export async function ensureOwnedOpenCashShift(
  repositories: Pick<RepositoryRegistry, "cashShifts">,
  input: { tenantId: string; actorUserId: string; branchId: string; cashShiftId: string },
): Promise<CashShift> {
  const shift = await repositories.cashShifts.getOpenByUserAndBranch(
    input.tenantId,
    input.actorUserId,
    input.branchId,
  );
  if (
    !shift ||
    shift.id !== input.cashShiftId ||
    shift.status !== CashShiftStatus.open ||
    shift.userId !== input.actorUserId ||
    shift.branchId !== input.branchId ||
    shift.tenantId !== input.tenantId
  ) {
    throw new PosServiceError("No hay un turno de caja abierto y vigente para esta sucursal.");
  }
  return shift;
}

/**
 * Capa de entitlement SaaS (feature/saas-entitlement-enforcement, auditoría §14) -- se suma a
 * `ensurePosPermission`, nunca lo sustituye. `pos.sales.read` (historial) sigue sin requerir esta
 * capability -- solo las mutaciones reales (venta, caja) la exigen.
 */
export async function ensureTenantCanUsePos(
  repositories: RepositoryRegistry,
  tenantId: string,
): Promise<void> {
  const entitlements = await new ResolveTenantEntitlementsService(repositories).execute(tenantId);
  ensureTenantCapability(entitlements, SaasCapabilityKey.pos);
}

export function cleanPosError(error: unknown, fallback: string) {
  if (error instanceof PosServiceError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
