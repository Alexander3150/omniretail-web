import { CustomerStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CustomerDto } from "@/modules/administration/application/dto/CustomerDto";
import { toCustomerDto } from "@/modules/administration/application/mappers/CustomerMapper";
import {
  ensureCanManageCustomers,
  ensureCustomerActor,
  ensureCustomerBelongsToTenant,
  ensureCustomerTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class ArchiveCustomerService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    customerId: string,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<CustomerDto> {
    ensureCanManageCustomers(permissions);
    ensureCustomerTenant(tenantId);
    ensureCustomerActor(actorUserId);
    const current = ensureCustomerBelongsToTenant(
      await this.repositories.customers.getById(customerId),
      tenantId,
    );

    const customer = ensureCustomerBelongsToTenant(
      await this.repositories.customers.update(current.id, { status: CustomerStatus.archived }),
      tenantId,
    );
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "customer.archived",
      entityType: "Customer",
      entityId: customer.id,
      metadata: {
        code: customer.code,
        previousStatus: current.status,
        status: customer.status,
      },
    });

    return toCustomerDto(customer);
  }
}
