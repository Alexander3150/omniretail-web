import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  BankAccountDto,
  BankAccountInputDto,
} from "@/modules/administration/application/dto/BankAccountDto";
import { toBankAccountDto } from "@/modules/administration/application/mappers/BankAccountMapper";
import {
  ensureBankAccountActor,
  ensureBankAccountBelongsToTenant,
  ensureBankAccountTenant,
  ensureCanManageBankAccounts,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeBankAccountInput,
  validateBankAccountInput,
} from "@/modules/administration/validation/bankAccount.validation";

export class UpdateBankAccountService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    accountId: string,
    dto: BankAccountInputDto,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<BankAccountDto> {
    ensureCanManageBankAccounts(permissions);
    ensureBankAccountTenant(tenantId);
    ensureBankAccountActor(actorUserId);
    const current = ensureBankAccountBelongsToTenant(
      await this.repositories.bankAccounts.getById(accountId),
      tenantId,
    );
    validateBankAccountInput(dto);

    const input = normalizeBankAccountInput(dto);
    const account = ensureBankAccountBelongsToTenant(
      await this.repositories.bankAccounts.update(current.id, input),
      tenantId,
    );
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "bank_account.updated",
      entityType: "BankAccount",
      entityId: account.id,
      metadata: {
        alias: account.alias,
        previousStatus: current.status,
        status: account.status,
      },
    });

    return toBankAccountDto(account);
  }
}
