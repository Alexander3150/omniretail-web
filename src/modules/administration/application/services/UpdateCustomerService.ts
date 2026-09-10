import type { CustomerRepository } from "@/core/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  CustomerDto,
  CustomerUpdateInputDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { toCustomerDto } from "@/modules/administration/application/mappers/CustomerMapper";
import {
  ensureCanManageCustomers,
  ensureCustomerActor,
  ensureCustomerBelongsToTenant,
  ensureCustomerTenant,
  ensureUniqueCustomer,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeCustomerInput,
  validateCustomerInput,
  validateCustomerStatus,
} from "@/modules/administration/validation/customer.validation";

type CustomerPatch = Parameters<CustomerRepository["update"]>[1];

export class UpdateCustomerService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    customerId: string,
    dto: CustomerUpdateInputDto,
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

    const patch = await this.buildPatch(current, dto, tenantId);
    const customer = ensureCustomerBelongsToTenant(
      await this.repositories.customers.update(current.id, patch),
      tenantId,
    );
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "customer.updated",
      entityType: "Customer",
      entityId: customer.id,
      metadata: {
        code: customer.code,
        previousStatus: current.status,
        status: customer.status,
        linked: current.userId !== undefined,
      },
    });

    return toCustomerDto(customer);
  }

  private async buildPatch(
    current: ReturnType<typeof ensureCustomerBelongsToTenant>,
    dto: CustomerUpdateInputDto,
    tenantId: string,
  ): Promise<CustomerPatch> {
    if (current.userId !== undefined) {
      validateCustomerStatus(dto.status);
      return { status: dto.status };
    }

    validateCustomerInput(dto);
    const input = normalizeCustomerInput(dto);
    const customers = await this.repositories.customers.getAll();
    ensureUniqueCustomer(customers, tenantId, input.code, input.email, current.id);
    return input;
  }
}
