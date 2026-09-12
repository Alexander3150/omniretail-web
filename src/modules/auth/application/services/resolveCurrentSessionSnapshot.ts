import type { Role, User } from "@/core/entities";
import { UserStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

type SessionRepositories = Pick<RepositoryRegistry, "auth" | "users" | "roles">;

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

  const role = user.roleId ? await repositories.roles.getById(user.roleId) : null;
  return { user, role };
}
