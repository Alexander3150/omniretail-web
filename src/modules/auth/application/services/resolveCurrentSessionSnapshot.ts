import type { Role, User } from "@/core/entities";
import { RoleStatus, TenantStatus, UserStatus, UserType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

type SessionRepositories = Pick<RepositoryRegistry, "auth" | "users" | "roles" | "tenants">;

export interface CurrentSessionSnapshot {
  user: User | null;
  role: Role | null;
  error?: string;
}

/**
 * Reconstruye el estado derivado de autenticacion exclusivamente desde
 * el puntero de sesion persistido y los repositories canonicos. No
 * acepta User, Role ni ningun dato de identidad provisto por la UI.
 */
export async function resolveCurrentSessionSnapshot(
  repositories: SessionRepositories,
): Promise<CurrentSessionSnapshot> {
  const sessionId = await repositories.auth.getCurrentSessionId();
  if (!sessionId) {
    return { user: null, role: null };
  }

  const session = await repositories.auth.getSession(sessionId);
  if (!session) {
    return { user: null, role: null };
  }

  const user = await repositories.users.getById(session.userId);
  if (!user) {
    return {
      user: null,
      role: null,
      error: "No se pudo resolver el usuario de la sesion actual.",
    };
  }

  if (user.status !== UserStatus.active) {
    return {
      user: null,
      role: null,
      error: "La cuenta ya no esta activa.",
    };
  }

  const role = user.roleId
    ? await repositories.roles.getByIdScoped(user.tenantId, user.roleId)
    : null;
  if (user.type === UserType.employee) {
    const tenant = await repositories.tenants.getById(user.tenantId);
    if (!tenant || tenant.status !== TenantStatus.active) {
      return {
        user: null,
        role: null,
        error: "El negocio de la cuenta no esta activo.",
      };
    }
    if (!role || role.status !== RoleStatus.active) {
      return {
        user: null,
        role: null,
        error: "El rol de la cuenta no esta activo en el negocio.",
      };
    }
  }
  return { user, role };
}
