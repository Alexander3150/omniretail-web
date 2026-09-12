import type { CustomerPaymentMethod } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { PaymentMethodFormDto } from "@/modules/customer/application/dto/PaymentMethodFormDto";
import { resolveCustomerAuthorizationContext } from "@/modules/customer/application/services/CustomerAuthorizationContext";

type PaymentMethodRepositories = Pick<
  RepositoryRegistry,
  "auth" | "users" | "roles" | "customers" | "customerPaymentMethods"
>;

/**
 * Application services de Metodos de pago. Misma disciplina que
 * addressService: unicamente `repositories` + datos de negocio en la
 * firma publica -- tenantId/customerId se resuelven internamente en
 * cada llamada, nunca se aceptan del caller. La allowlist runtime y las
 * invariantes de default siguen viviendo en MockCustomerPaymentMethodRepository.
 */

export async function listPaymentMethods(
  repositories: PaymentMethodRepositories,
): Promise<CustomerPaymentMethod[]> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  return repositories.customerPaymentMethods.getByCustomer(context.tenantId, context.customerId);
}

export async function createPaymentMethod(
  repositories: PaymentMethodRepositories,
  dto: PaymentMethodFormDto,
): Promise<CustomerPaymentMethod> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  // brand/last4/expiracion/titular son los unicos campos que vienen del
  // formulario -- tenantId/customerId salen del contexto resuelto, y
  // type/providerPaymentMethodId/isDefault los fija el repositorio.
  return repositories.customerPaymentMethods.create({
    tenantId: context.tenantId,
    customerId: context.customerId,
    brand: dto.brand.trim(),
    last4: dto.last4.trim(),
    expirationMonth: Number(dto.expirationMonth),
    expirationYear: Number(dto.expirationYear),
    cardholderName: dto.cardholderName.trim() || undefined,
  });
}

export async function updatePaymentMethod(
  repositories: PaymentMethodRepositories,
  paymentMethodId: string,
  dto: PaymentMethodFormDto,
): Promise<CustomerPaymentMethod> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  // brand y last4 no son editables (la "tarjeta" en si no cambia; para
  // eso se agrega una nueva) -- ni se envian aunque el formulario los
  // muestre de nuevo.
  return repositories.customerPaymentMethods.update(
    context.tenantId,
    context.customerId,
    paymentMethodId,
    {
      cardholderName: dto.cardholderName.trim() || undefined,
      expirationMonth: Number(dto.expirationMonth),
      expirationYear: Number(dto.expirationYear),
    },
  );
}

export async function removePaymentMethod(
  repositories: PaymentMethodRepositories,
  paymentMethodId: string,
): Promise<void> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  return repositories.customerPaymentMethods.remove(
    context.tenantId,
    context.customerId,
    paymentMethodId,
  );
}

export async function setDefaultPaymentMethod(
  repositories: PaymentMethodRepositories,
  paymentMethodId: string,
): Promise<CustomerPaymentMethod> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  return repositories.customerPaymentMethods.setDefault(
    context.tenantId,
    context.customerId,
    paymentMethodId,
  );
}
