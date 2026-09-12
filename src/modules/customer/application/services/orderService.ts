import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  toCustomerOrderSummaryDto,
  type CustomerOrderSummaryDto,
} from "@/modules/customer/application/dto/CustomerOrderSummaryDto";
import { resolveCustomerAuthorizationContext } from "@/modules/customer/application/services/CustomerAuthorizationContext";

type OrderRepositories = Pick<RepositoryRegistry, "auth" | "users" | "roles" | "customers" | "orders">;

/**
 * Solo lectura, tal como quedo definido en el alcance de este PR:
 * cualquier accion sobre un pedido (cancelar, ver detalle completo,
 * reordenar) es responsabilidad del modulo storefront, no de este.
 *
 * No recibe customerId/tenantId del caller -- los resuelve internamente
 * via el mismo contexto canonico que Profile/Addresses/PaymentMethods,
 * y repositories.orders.getByCustomer exige ambos igual que los demas
 * repositorios de este modulo.
 */
export async function getCurrentCustomerOrders(
  repositories: OrderRepositories,
): Promise<CustomerOrderSummaryDto[]> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  const orders = await repositories.orders.getByCustomer(context.tenantId, context.customerId);
  return [...orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toCustomerOrderSummaryDto);
}
