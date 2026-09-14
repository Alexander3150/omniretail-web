import { OrderStatus, SaleStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { toCustomerDto } from "@/modules/administration/application/mappers/CustomerMapper";
import {
  ensureCanReadCustomers,
  ensureCustomerTenant,
} from "@/modules/administration/application/services/serviceHelpers";

/**
 * La frecuencia de compra combina Order (e-commerce) y Sale (mostrador): un cliente puede
 * comprar por cualquiera de los dos canales y ambos cuentan para el ranking. Se lee directamente
 * de los repositorios compartidos -- sin contrato nuevo en core -- mismo patron que Dashboard y
 * Reportes.
 */
export class GetCustomersService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<CustomerDto[]> {
    ensureCanReadCustomers(permissions);
    ensureCustomerTenant(tenantId);

    const [customers, orders, sales] = await Promise.all([
      this.repositories.customers.getAll(),
      this.repositories.orders.getAll(),
      this.repositories.sales.getAll(),
    ]);

    const purchaseCounts = new Map<string, number>();
    for (const order of orders) {
      if (order.tenantId !== tenantId) continue;
      if (order.status === OrderStatus.cancelled) continue;
      if (!order.customerId) continue;
      purchaseCounts.set(order.customerId, (purchaseCounts.get(order.customerId) ?? 0) + 1);
    }
    for (const sale of sales) {
      if (sale.tenantId !== tenantId) continue;
      if (sale.status === SaleStatus.cancelled) continue;
      if (!sale.customerId) continue;
      purchaseCounts.set(sale.customerId, (purchaseCounts.get(sale.customerId) ?? 0) + 1);
    }

    return customers
      .filter((customer) => customer.tenantId === tenantId)
      .map((customer) => toCustomerDto(customer, purchaseCounts.get(customer.id) ?? 0))
      .sort(
        (left, right) => right.purchaseCount - left.purchaseCount || left.name.localeCompare(right.name),
      );
  }
}
