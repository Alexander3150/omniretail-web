import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  CustomerCreateInputDto,
  CustomerDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { toCustomerDto } from "@/modules/administration/application/mappers/CustomerMapper";
import {
  ensureCanManageCustomers,
  ensureCustomerActor,
  ensureCustomerTenant,
  ensureUniqueCustomer,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeCustomerInput,
  validateCustomerInput,
} from "@/modules/administration/validation/customer.validation";

export class CreateCustomerService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    dto: CustomerCreateInputDto,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<CustomerDto> {
    ensureCanManageCustomers(permissions);
    ensureCustomerTenant(tenantId);
    ensureCustomerActor(actorUserId);
    validateCustomerInput(dto);

    const input = normalizeCustomerInput(dto);
    const customers = await this.repositories.customers.getAll();
    ensureUniqueCustomer(customers, tenantId, input.code, input.email);
    const customer = await this.repositories.customers.create({ tenantId, ...input });
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "customer.created",
      entityType: "Customer",
      entityId: customer.id,
      metadata: {
        code: customer.code,
        name: customer.name,
        email: customer.email,
        status: customer.status,
      },
    });

    return toCustomerDto(customer);
  }
}
