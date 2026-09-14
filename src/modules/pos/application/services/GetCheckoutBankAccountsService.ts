import { isBranchScopedResourceAvailable } from "@/core/scopes/branchScope";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CheckoutBankAccountDto } from "@/modules/pos/application/dto/CheckoutDto";

export interface GetCheckoutBankAccountsInput {
  tenantId: string;
  branchId: string;
}

/**
 * Cuentas bancarias disponibles para que el cajero elija al cobrar por transferencia. El límite
 * de tenant vive en el repositorio (`getActiveByTenant`), no en un filtro posterior en memoria:
 * `tenantId`/`branchId` llegan resueltos de la sesión/sucursal activa, nunca de un valor libre
 * enviado por la UI. El número completo (`accountNumber`) solo se devuelve acá -- es el único
 * consumidor autorizado a recibirlo; el listado general de Administration solo expone
 * `accountNumberMasked` (ver `BankAccountDto`).
 */
export class GetCheckoutBankAccountsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(input: GetCheckoutBankAccountsInput): Promise<CheckoutBankAccountDto[]> {
    const [accounts, tenant] = await Promise.all([
      this.repositories.bankAccounts.getActiveByTenant(input.tenantId),
      this.repositories.tenants.getById(input.tenantId),
    ]);
    if (!tenant) return [];

    return accounts
      .filter(
        (account) =>
          account.currency === tenant.defaultCurrency &&
          isBranchScopedResourceAvailable(account.branchIds, input.branchId),
      )
      .map((account) => ({
        id: account.id,
        bankName: account.bankName,
        accountType: account.accountType,
        holderName: account.holderName,
        accountNumber: account.accountNumber,
        currency: account.currency,
      }));
  }
}
