import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { toCustomerDto } from "@/modules/administration/application/mappers/CustomerMapper";
import {
  ensureCanReadCustomers,
  ensureCustomerTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetCustomersService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<CustomerDto[]> {
    ensureCanReadCustomers(permissions);
    ensureCustomerTenant(tenantId);
    const customers = await this.repositories.customers.getAll();

    return customers
      .filter((customer) => customer.tenantId === tenantId)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(toCustomerDto);
  }
}
