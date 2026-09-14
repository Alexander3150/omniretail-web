import type { Customer, User } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { ProfileFormDto } from "@/modules/customer/application/dto/ProfileFormDto";
import { resolveCustomerIdentity } from "@/modules/customer/application/services/resolveCustomerIdentity";

const PROFILE_UPDATE_PERMISSION = "customer.account.update";

export class ProfileUpdateNotAllowedError extends Error {}

/**
 * Boundary autorizado para actualizar el perfil del cliente autenticado.
 * No recibe customerId como parametro -- lo resuelve internamente desde
 * la sesion (resolveCustomerIdentity), asi que no existe forma de pasarle
 * el id de otro cliente por error ni a proposito. Exige explicitamente el
 * permiso de actualizacion (no basta con poder leer la pagina) y aplica
 * un allowlist de campos editables: nunca reenvia el dto completo al
 * repositorio, y el email (Customer/User/AuthAccount, campos
 * independientes) nunca se toca desde aca.
 */
export async function updateCustomerProfile(params: {
  user: User | null;
  hasPermission: (permission: string) => boolean;
  repositories: Pick<RepositoryRegistry, "customers">;
  dto: ProfileFormDto;
}): Promise<Customer> {
  const { user, hasPermission, repositories, dto } = params;

  if (!hasPermission(PROFILE_UPDATE_PERMISSION)) {
    throw new ProfileUpdateNotAllowedError("No tienes permiso para actualizar el perfil.");
  }

  const identity = await resolveCustomerIdentity(user, repositories);

  return repositories.customers.update(identity.customerId, {
    name: dto.name.trim(),
    phone: dto.phone.trim() || undefined,
  });
}
