import type { Customer } from "@/core/entities";
import { UserStatus, UserType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export class CustomerIdentityError extends Error {}

export interface CustomerAuthorizationContext {
  userId: string;
  tenantId: string;
  customerId: string;
  customer: Customer;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
}

type ContextRepositories = Pick<RepositoryRegistry, "auth" | "users" | "roles" | "customers">;

/**
 * UNICA resolucion canonica del "actor Customer" para todo el modulo.
 * Deliberadamente NO recibe ningun parametro de identidad ni de
 * autorizacion (nada de user, customerId, tenantId, hasPermission,
 * roleId) -- toma unicamente `repositories`, que es una capacidad de
 * infraestructura (inyectada de forma identica para toda la app via
 * RepositoryProvider), nunca algo que un caller pueda usar para
 * suplantar a otro cliente.
 *
 * Repite, desde cero y en cada llamada, la misma cadena que ya usa
 * CurrentSessionProvider para resolver la sesion -- reutiliza los mismos
 * repositories (auth/users/roles/customers), no crea una segunda fuente
 * de sesion:
 *
 *   auth.getCurrentSessionId() -> auth.getSession() -> users.getById()
 *   -> User.status === active -> User.type === customer
 *   -> customers.getByUserId() -> tenant coherente
 *   -> relacion User.customerId <-> Customer.id
 *   -> roles.getById() -> Role existe y pertenece al mismo tenant ->
 *      permissions reales
 *
 * Profile, Addresses, PaymentMethods y Orders dependen TODOS de esta
 * misma funcion -- no debe existir una segunda forma de resolver "que
 * Customer opera".
 */
export async function resolveCustomerAuthorizationContext(
  repositories: ContextRepositories,
): Promise<CustomerAuthorizationContext> {
  const sessionId = await repositories.auth.getCurrentSessionId();
  if (!sessionId) {
    throw new CustomerIdentityError("No hay una sesion activa.");
  }

  const session = await repositories.auth.getSession(sessionId);
  if (!session) {
    throw new CustomerIdentityError("La sesion no es valida.");
  }

  const user = await repositories.users.getById(session.userId);
  if (!user) {
    throw new CustomerIdentityError("El usuario de la sesion no existe.");
  }
  if (user.status !== UserStatus.active) {
    throw new CustomerIdentityError("El usuario de la sesion no esta activo.");
  }
  if (user.type !== UserType.customer) {
    throw new CustomerIdentityError("La sesion actual no corresponde a un cliente.");
  }

  const customer = await repositories.customers.getByUserId(user.id);
  if (!customer) {
    throw new CustomerIdentityError("No se encontro la cuenta de cliente asociada a la sesion.");
  }
  if (customer.tenantId !== user.tenantId) {
    throw new CustomerIdentityError("El tenant del cliente no coincide con el de la sesion.");
  }
  // Si el User ya trae customerId propio, debe coincidir con lo resuelto
  // via getByUserId -- una discrepancia aca indica datos corruptos o un
  // intento de suplantacion, nunca algo a ignorar en silencio.
  if (user.customerId && user.customerId !== customer.id) {
    throw new CustomerIdentityError("La relacion entre el usuario y el cliente es inconsistente.");
  }

  // Un Role solo es una fuente valida de permisos si existe y pertenece
  // AL MISMO tenant que el User -- nunca se confia en el objeto Role por
  // el solo hecho de que user.roleId apunte a el. Sin esto, un roleId
  // corrupto/manipulado que apuntara a un Role de otro tenant otorgaria
  // silenciosamente los permisos de ese Role ajeno.
  let permissions: string[] = [];
  if (user.roleId) {
    const role = await repositories.roles.getById(user.roleId);
    if (!role) {
      throw new CustomerIdentityError("El rol del usuario no existe.");
    }
    if (role.tenantId !== user.tenantId) {
      throw new CustomerIdentityError("El rol del usuario pertenece a otro tenant.");
    }
    permissions = role.permissions;
  }

  return {
    userId: user.id,
    tenantId: customer.tenantId,
    customerId: customer.id,
    customer,
    permissions,
    hasPermission: (permission: string) => permissions.includes(permission),
  };
}
