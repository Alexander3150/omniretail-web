import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  BankAccountDto,
  BankAccountInputDto,
} from "@/modules/administration/application/dto/BankAccountDto";
import { toBankAccountDto } from "@/modules/administration/application/mappers/BankAccountMapper";
import {
  ensureBankAccountActor,
  ensureBankAccountTenant,
  ensureCanManageBankAccounts,
} from "@/modules/administration/application/services/serviceHelpers";
import {
  normalizeBankAccountInput,
  validateBankAccountInput,
} from "@/modules/administration/validation/bankAccount.validation";

export class CreateBankAccountService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    dto: BankAccountInputDto,
    permissions: readonly string[],
    actorUserId: string,
  ): Promise<BankAccountDto> {
    ensureCanManageBankAccounts(permissions);
    ensureBankAccountTenant(tenantId);
    ensureBankAccountActor(actorUserId);
    validateBankAccountInput(dto);

    const input = normalizeBankAccountInput(dto);
    const account = await this.repositories.bankAccounts.create({ tenantId, ...input });
    await this.repositories.auditLogs.append({
      tenantId,
      actorUserId,
      action: "bank_account.created",
      entityType: "BankAccount",
      entityId: account.id,
      metadata: {
        alias: account.alias,
        bankName: account.bankName,
        currency: account.currency,
        status: account.status,
      },
    });

    return toBankAccountDto(account);
  }
}
