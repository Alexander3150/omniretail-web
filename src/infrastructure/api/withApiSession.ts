import type { Branch, Role, Tenant, User } from "@/core/entities";
import { type BranchType, UserType } from "@/core/enums";
import type { BranchRepository } from "@/core/repositories";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { ApiAuthRepository } from "@/infrastructure/api/ApiAuthRepository";
import { ApiBranchRepository } from "@/infrastructure/api/ApiBranchRepository";
import { toRole, toTenant, toUser } from "@/infrastructure/api/apiSessionMapper";
import { CurrentSessionClient } from "@/infrastructure/api/CurrentSessionClient";

/**
 * Devuelve `target` con algunos metodos reemplazados; el resto se delega al objeto original
 * (enlazado a el, para que los repositorios mock sigan funcionando igual).
 */
function withOverrides<T extends object>(target: T, overrides: Partial<T>): T {
  return new Proxy(target, {
    get(object, property) {
      if (Object.prototype.hasOwnProperty.call(overrides, property)) {
        return overrides[property as keyof T];
      }
      const value = Reflect.get(object, property, object);
      return typeof value === "function" ? value.bind(object) : value;
    },
  });
}

/**
 * Sucursales desde el backend solo con sesion de empleado y, en los metodos por tienda, solo para
 * la tienda de esa sesion: `/administration/branches` exige `admin.branches.read`, asi que el
 * storefront publico y las cuentas de cliente siguen leyendo el mock (como antes de migrar).
 */
function apiBranchesForEmployees(
  mock: BranchRepository,
  api: BranchRepository,
  currentSession: CurrentSessionClient,
): BranchRepository {
  const resolve = async (tenantId?: string): Promise<BranchRepository> => {
    const current = await currentSession.get();
    const isEmployee = current?.user.type === UserType.employee;
    const sameTenant = tenantId === undefined || current?.user.tenantId === tenantId;
    return isEmployee && sameTenant ? api : mock;
  };

  return {
    getAll: async (): Promise<Branch[]> => (await resolve()).getAll(),
    getById: async (id: string) => (await resolve()).getById(id),
    getByIdScoped: async (tenantId: string, id: string) =>
      (await resolve(tenantId)).getByIdScoped(tenantId, id),
    getActive: async () => (await resolve()).getActive(),
    getActiveByTenant: async (tenantId: string) =>
      (await resolve(tenantId)).getActiveByTenant(tenantId),
    listByTenant: async (tenantId: string) => (await resolve(tenantId)).listByTenant(tenantId),
    getActiveByTenantAndType: async (tenantId: string, type: BranchType) =>
      (await resolve(tenantId)).getActiveByTenantAndType(tenantId, type),
    create: async (input) => (await resolve(input.tenantId)).create(input),
    update: async (id, input) => (await resolve()).update(id, input),
  };
}

/**
 * Modo api: reemplaza `auth` por ApiAuthRepository, `branches` por ApiBranchRepository (ver
 * `apiBranchesForEmployees`) y adapta `users`, `roles` y `tenants` para que
 * la identidad de la sesion actual (usuario, rol con permisos, tienda) salga de /auth/me. Cualquier
 * otra lectura se delega al mock, asi los modulos no migrados siguen igual.
 *
 * Asi `resolveCurrentSessionSnapshot`, `CurrentSessionProvider` y las pantallas no cambian: siguen
 * consumiendo los mismos contratos y no saben si la sesion viene del mock o del backend.
 */
export function withApiSession(repositories: RepositoryRegistry, eventBus: DataEventBus): RepositoryRegistry {
  const currentSession = new CurrentSessionClient();

  const users = withOverrides(repositories.users, {
    async getById(id: string): Promise<User | null> {
      const current = await currentSession.get();
      return current && current.user.id === id ? toUser(current) : repositories.users.getById(id);
    },
    async getByIdScoped(tenantId: string, id: string): Promise<User | null> {
      const current = await currentSession.get();
      return current && current.user.id === id && current.user.tenantId === tenantId
        ? toUser(current)
        : repositories.users.getByIdScoped(tenantId, id);
    },
  });

  const roles = withOverrides(repositories.roles, {
    async getByIdScoped(tenantId: string, id: string): Promise<Role | null> {
      const current = await currentSession.get();
      if (current && current.user.tenantId === tenantId && current.role?.id === id) {
        return toRole(current);
      }
      return repositories.roles.getByIdScoped(tenantId, id);
    },
  });

  const tenants = withOverrides(repositories.tenants, {
    async getById(id: string): Promise<Tenant | null> {
      const current = await currentSession.get();
      return current && current.tenant.id === id ? toTenant(current) : repositories.tenants.getById(id);
    },
  });

  return {
    ...repositories,
    auth: new ApiAuthRepository(currentSession, repositories.tenants, eventBus),
    users,
    roles,
    tenants,
    branches: apiBranchesForEmployees(
      repositories.branches,
      new ApiBranchRepository(eventBus),
      currentSession,
    ),
  };
}
