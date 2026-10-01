import type { Branch, Role, Tenant, User } from "@/core/entities";
import { type BranchType, type PlanCode, UserType } from "@/core/enums";
import type {
  BranchRepository,
  PlanRepository,
  RoleRepository,
  TenantSubscriptionRepository,
  UserRepository,
} from "@/core/repositories";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { ApiAuthRepository } from "@/infrastructure/api/ApiAuthRepository";
import { ApiBranchRepository } from "@/infrastructure/api/ApiBranchRepository";
import { ApiPlanRepository } from "@/infrastructure/api/ApiPlanRepository";
import { ApiRoleRepository } from "@/infrastructure/api/ApiRoleRepository";
import { ApiTenantSubscriptionRepository } from "@/infrastructure/api/ApiTenantSubscriptionRepository";
import { ApiUserRepository } from "@/infrastructure/api/ApiUserRepository";
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
 * Elige entre el repositorio del backend y el mock en cada llamada: el backend solo con sesion de
 * empleado, solo para la tienda de esa sesion (en los metodos que reciben `tenantId`) y, si se
 * indican `permissions`, solo cuando el rol de /auth/me tiene alguno de ellos. Asi el storefront
 * publico, las cuentas de cliente y los empleados sin el permiso del endpoint siguen leyendo el
 * mock (como antes de migrar) en vez de recibir un 403 seguro del backend.
 */
function employeeRouter<T>(
  mock: T,
  api: T,
  currentSession: CurrentSessionClient,
  permissions: readonly string[] = [],
) {
  return async (tenantId?: string): Promise<T> => {
    const current = await currentSession.get();
    if (current?.user.type !== UserType.employee) return mock;
    if (tenantId !== undefined && current.user.tenantId !== tenantId) return mock;
    const granted = current.role?.permissions ?? [];
    const allowed = permissions.length === 0 || permissions.some((key) => granted.includes(key));
    return allowed ? api : mock;
  };
}

/** `/administration/branches` exige `admin.branches.read`. */
function apiBranchesForEmployees(
  mock: BranchRepository,
  api: BranchRepository,
  currentSession: CurrentSessionClient,
): BranchRepository {
  const resolve = employeeRouter(mock, api, currentSession);

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
 * `/administration/roles` exige `admin.roles.read`. El rol de la sesion actual sale siempre de
 * /auth/me, que no requiere ese permiso (un cajero tambien necesita resolver su propio rol).
 */
function apiRolesForEmployees(
  mock: RoleRepository,
  api: RoleRepository,
  currentSession: CurrentSessionClient,
): RoleRepository {
  const resolve = employeeRouter(mock, api, currentSession, ["admin.roles.read", "admin.roles.manage"]);

  return {
    listByTenant: async (tenantId: string) => (await resolve(tenantId)).listByTenant(tenantId),
    async getByIdScoped(tenantId: string, id: string): Promise<Role | null> {
      const current = await currentSession.get();
      if (current && current.user.tenantId === tenantId && current.role?.id === id) {
        return toRole(current);
      }
      return (await resolve(tenantId)).getByIdScoped(tenantId, id);
    },
    create: async (input) => (await resolve(input.tenantId)).create(input),
    updateScoped: async (tenantId, id, input) =>
      (await resolve(tenantId)).updateScoped(tenantId, id, input),
    archiveScoped: async (tenantId, id) => (await resolve(tenantId)).archiveScoped(tenantId, id),
  };
}

/**
 * `/administration/users` exige `admin.users.read` y solo devuelve empleados. El usuario de la
 * sesion actual sale siempre de /auth/me, que no requiere ese permiso.
 */
function apiUsersForEmployees(
  mock: UserRepository,
  api: UserRepository,
  currentSession: CurrentSessionClient,
): UserRepository {
  const resolve = employeeRouter(mock, api, currentSession, ["admin.users.read", "admin.users.manage"]);

  return {
    getAll: async () => (await resolve()).getAll(),
    async getById(id: string): Promise<User | null> {
      const current = await currentSession.get();
      return current && current.user.id === id ? toUser(current) : (await resolve()).getById(id);
    },
    getByEmail: async (email: string) => (await resolve()).getByEmail(email),
    listByTenant: async (tenantId: string) => (await resolve(tenantId)).listByTenant(tenantId),
    async getByIdScoped(tenantId: string, id: string): Promise<User | null> {
      const current = await currentSession.get();
      return current && current.user.id === id && current.user.tenantId === tenantId
        ? toUser(current)
        : (await resolve(tenantId)).getByIdScoped(tenantId, id);
    },
    getByEmployeeCodeScoped: async (tenantId: string, employeeCode: string) =>
      (await resolve(tenantId)).getByEmployeeCodeScoped(tenantId, employeeCode),
    create: async (input) => (await resolve(input.tenantId)).create(input),
    update: async (id, input) => (await resolve()).update(id, input),
    updateScoped: async (tenantId, id, input) =>
      (await resolve(tenantId)).updateScoped(tenantId, id, input),
    updateStatus: async (id, status) => (await resolve()).updateStatus(id, status),
  };
}

/** `/admin/subscriptions` exige `admin.plans.read`. */
function apiSubscriptionsForEmployees(
  mock: TenantSubscriptionRepository,
  api: TenantSubscriptionRepository,
  currentSession: CurrentSessionClient,
): TenantSubscriptionRepository {
  const resolve = employeeRouter(mock, api, currentSession, ["admin.plans.read"]);

  return {
    getByTenantId: async (tenantId: string) => (await resolve(tenantId)).getByTenantId(tenantId),
    listInvoices: async (tenantId: string) => (await resolve(tenantId)).listInvoices(tenantId),
    ensureInvoice: async (input) => (await resolve(input.tenantId)).ensureInvoice(input),
    create: async (input) => (await resolve(input.tenantId)).create(input),
    update: async (tenantId, input) => (await resolve(tenantId)).update(tenantId, input),
  };
}

/**
 * `/admin/plans` exige `admin.plans.read`. Sin ese permiso (o sin sesion: alta publica de negocio)
 * se usa el catalogo mock, igual que antes.
 */
function apiPlansForEmployees(
  mock: PlanRepository,
  api: PlanRepository,
  currentSession: CurrentSessionClient,
): PlanRepository {
  const resolve = employeeRouter(mock, api, currentSession, ["admin.plans.read"]);

  return {
    listActive: async () => (await resolve()).listActive(),
    getById: async (id: string) => (await resolve()).getById(id),
    getByCode: async (code: PlanCode) => (await resolve()).getByCode(code),
  };
}

/**
 * Modo api: reemplaza `auth` por ApiAuthRepository y enruta al backend el nucleo de administracion
 * (`branches`, `roles`, `users`, `tenantSubscriptions`, `plans`) para empleados con el permiso de
 * cada endpoint (ver `employeeRouter`). La identidad de la sesion actual (usuario, rol con
 * permisos, tienda) sale de /auth/me. Cualquier otra lectura se delega al mock, asi los modulos no
 * migrados siguen igual.
 *
 * Asi `resolveCurrentSessionSnapshot`, `CurrentSessionProvider` y las pantallas no cambian: siguen
 * consumiendo los mismos contratos y no saben si los datos vienen del mock o del backend.
 */
export function withApiSession(repositories: RepositoryRegistry, eventBus: DataEventBus): RepositoryRegistry {
  const currentSession = new CurrentSessionClient();

  const tenants = withOverrides(repositories.tenants, {
    async getById(id: string): Promise<Tenant | null> {
      const current = await currentSession.get();
      return current && current.tenant.id === id ? toTenant(current) : repositories.tenants.getById(id);
    },
  });

  return {
    ...repositories,
    auth: new ApiAuthRepository(currentSession, repositories.tenants, eventBus),
    tenants,
    users: apiUsersForEmployees(repositories.users, new ApiUserRepository(eventBus), currentSession),
    roles: apiRolesForEmployees(repositories.roles, new ApiRoleRepository(eventBus), currentSession),
    branches: apiBranchesForEmployees(
      repositories.branches,
      new ApiBranchRepository(eventBus),
      currentSession,
    ),
    tenantSubscriptions: apiSubscriptionsForEmployees(
      repositories.tenantSubscriptions,
      new ApiTenantSubscriptionRepository(eventBus),
      currentSession,
    ),
    plans: apiPlansForEmployees(repositories.plans, new ApiPlanRepository(), currentSession),
  };
}
