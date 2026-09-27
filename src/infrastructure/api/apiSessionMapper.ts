import type { BranchScope, Role, Session, Tenant, User } from "@/core/entities";
import { TenantStatus, type RoleStatus, type UserStatus, type UserType } from "@/core/enums";
import type { ApiCurrentSession } from "@/infrastructure/api/apiCurrentSession";

/**
 * TEMPORAL: pendiente de que /auth/me los incluya. Valores neutros para los campos que las
 * entidades del frontend exigen y /auth/me todavia no devuelve. Unico lugar donde se definen.
 *
 * - `status: active`: /auth/me ya responde 401 si el empleado tiene tienda o rol inactivos.
 * - Fechas: /auth/me no expone la creacion de la sesion, asi que todas usan su `expiresAt`.
 */
const TEMPORARY_DEFAULTS = {
  tenantStatus: TenantStatus.active,
  roleIsSystem: false,
  defaultCurrency: "GTQ",
  timezone: "America/Guatemala",
} as const;

function temporaryTimestamp(current: ApiCurrentSession): string {
  return current.session.expiresAt;
}

export function toUser(current: ApiCurrentSession): User {
  const { user } = current;
  const timestamp = temporaryTimestamp(current);
  return {
    id: user.id,
    tenantId: user.tenantId,
    customerId: user.customerId ?? undefined,
    employeeCode: user.employeeCode ?? undefined,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    type: user.type as UserType,
    status: user.status as UserStatus,
    roleId: user.roleId ?? undefined,
    branchId: user.branchId ?? undefined,
    allowedBranchIds: user.allowedBranchIds,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** null si /auth/me no trae rol (cliente sin rol activo). */
export function toRole(current: ApiCurrentSession): Role | null {
  const { role } = current;
  if (!role) return null;
  const timestamp = temporaryTimestamp(current);
  return {
    id: role.id,
    tenantId: current.user.tenantId,
    name: role.name,
    isSystem: TEMPORARY_DEFAULTS.roleIsSystem,
    permissions: role.permissions,
    branchScope: role.branchScope as BranchScope,
    status: role.status as RoleStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function toTenant(current: ApiCurrentSession): Tenant {
  const timestamp = temporaryTimestamp(current);
  return {
    id: current.tenant.id,
    name: current.tenant.name,
    slug: current.tenant.slug,
    status: TEMPORARY_DEFAULTS.tenantStatus,
    defaultCurrency: TEMPORARY_DEFAULTS.defaultCurrency,
    timezone: TEMPORARY_DEFAULTS.timezone,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** `activeBranchId` puede venir sobrescrito por la seleccion en memoria (ver ApiAuthRepository). */
export function toSession(current: ApiCurrentSession, activeBranchId?: string | null): Session {
  return {
    id: current.session.id,
    userId: current.user.id,
    createdAt: temporaryTimestamp(current),
    expiresAt: current.session.expiresAt,
    rememberMe: current.session.rememberMe,
    activeBranchId: (activeBranchId ?? current.session.activeBranchId) ?? undefined,
  };
}
