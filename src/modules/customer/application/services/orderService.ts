import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  toCustomerOrderSummaryDto,
  type CustomerOrderSummaryDto,
} from "@/modules/customer/application/dto/CustomerOrderSummaryDto";
import {
  toCustomerOrderDetailDto,
  type CustomerOrderDetailDto,
} from "@/modules/customer/application/dto/CustomerOrderDetailDto";
import { resolveCustomerAuthorizationContext } from "@/modules/customer/application/services/CustomerAuthorizationContext";

type OrderRepositories = Pick<
  RepositoryRegistry,
  "auth" | "users" | "roles" | "customers" | "orders" | "payments"
>;

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

/**
 * The lookup remains inside the customer/tenant boundary.  An arbitrary order id
 * is never sent to the generic repository lookup, so another customer's order
 * is indistinguishable from a missing one.
 */
export async function getCurrentCustomerOrderDetail(
  repositories: OrderRepositories,
  orderId: string,
): Promise<CustomerOrderDetailDto | null> {
  const context = await resolveCustomerAuthorizationContext(repositories);
  const orders = await repositories.orders.getByCustomer(context.tenantId, context.customerId);
  const order = orders.find((item) => item.id === orderId);
  if (!order) return null;
  const payment = (await repositories.payments.getByOrder(order.id))[0];
  return toCustomerOrderDetailDto(order, payment);
}
