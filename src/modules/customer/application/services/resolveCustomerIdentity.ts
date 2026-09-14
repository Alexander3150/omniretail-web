import type { Customer, User } from "@/core/entities";
import { UserType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";

export class CustomerIdentityError extends Error {}

export interface CustomerIdentity {
  tenantId: string;
  customerId: string;
  customer: Customer;
}

/**
 * Unica fuente de verdad para resolver "que Customer opera" en /cuenta/*.
 * Todo hook/servicio de este modulo debe pasar por aca en vez de resolver
 * el Customer por su cuenta -- asi la cadena de validacion (sesion valida
 * -> User correcto -> UserType.customer -> relacion User<->Customer ->
 * tenant coherente) vive en un solo lugar y nunca se deriva de un
 * customerId/tenantId recibido desde UI, navegacion o props.
 */
export async function resolveCustomerIdentity(
  user: User | null,
  repositories: Pick<RepositoryRegistry, "customers">,
): Promise<CustomerIdentity> {
  if (!user) {
    throw new CustomerIdentityError("No hay una sesion activa.");
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

  return { tenantId: customer.tenantId, customerId: customer.id, customer };
}
