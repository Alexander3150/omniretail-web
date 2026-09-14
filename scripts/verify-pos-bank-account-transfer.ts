import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BankAccount, Tenant } from "@/core/entities";
import { BranchStatus, BranchType, TenantStatus } from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { MockBankAccountRepository, MockTenantRepository } from "@/infrastructure/mock/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { GetCheckoutBankAccountsService } from "@/modules/pos/application/services/GetCheckoutBankAccountsService";

class MemoryStorageAdapter extends LocalStorageAdapter {
  private readonly values = new Map<string, string>();

  override get<T>(key: string): T | null {
    const value = this.values.get(key);
    return value === undefined ? null : (JSON.parse(value) as T);
  }

  override set<T>(key: string, value: T): void {
    this.values.set(key, JSON.stringify(value));
  }

  override remove(key: string): void {
    this.values.delete(key);
  }
}

const NOW = "2026-01-01T00:00:00.000Z";
const TENANT_A = "pos-bank-tenant-a";
const TENANT_B = "pos-bank-tenant-b";
const BRANCH_A1 = "pos-bank-branch-a1";
const BRANCH_A2 = "pos-bank-branch-a2";

function tenant(id: string, currency: Tenant["defaultCurrency"]): Tenant {
  return {
    id,
    name: id,
    slug: id,
    status: TenantStatus.active,
    defaultCurrency: currency,
    timezone: "America/Guatemala",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function bankAccount(overrides: Partial<BankAccount> & Pick<BankAccount, "id">): BankAccount {
  return {
    tenantId: TENANT_A,
    bankName: "Banco Demo",
    holderName: "FerrePharma Demo",
    accountNumber: "123456789012",
    accountNumberMasked: "********9012",
    accountType: "monetary",
    currency: "GTQ",
    alias: "Principal",
    branchIds: [],
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function createHarness() {
  const store = new MockDatabaseStore(new MemoryStorageAdapter());
  const eventBus = new DataEventBus();

  store.mutate((db) => {
    db.tenants = [tenant(TENANT_A, "GTQ"), tenant(TENANT_B, "GTQ")];
    db.branches = [
      {
        id: BRANCH_A1,
        tenantId: TENANT_A,
        code: "A1",
        name: "Sucursal A1",
        type: BranchType.store,
        status: BranchStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: BRANCH_A2,
        tenantId: TENANT_A,
        code: "A2",
        name: "Sucursal A2",
        type: BranchType.store,
        status: BranchStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    db.bankAccounts = [
      bankAccount({ id: "account-branch-a1-only", branchIds: [BRANCH_A1] }),
      bankAccount({ id: "account-all-branches", branchIds: [] }),
      bankAccount({ id: "account-inactive", status: "inactive" }),
      bankAccount({ id: "account-tenant-b", tenantId: TENANT_B }),
      bankAccount({ id: "account-wrong-currency", currency: "USD" }),
    ];
  });

  const bankAccounts = new MockBankAccountRepository(store, eventBus);
  const tenants = new MockTenantRepository(store, eventBus);

  return {
    repositories: { bankAccounts, tenants } as unknown as RepositoryRegistry,
  };
}

async function verifyServiceBehavior(harness: ReturnType<typeof createHarness>) {
  const service = new GetCheckoutBankAccountsService(harness.repositories);

  const forBranchA1 = await service.execute({ tenantId: TENANT_A, branchId: BRANCH_A1 });
  const byId = new Map(forBranchA1.map((item) => [item.id, item]));

  // B. POS transfer recibe el numero completo, sin mascara.
  assert.equal(
    byId.get("account-branch-a1-only")?.accountNumber,
    "123456789012",
    "El servicio debe devolver accountNumber completo, no enmascarado",
  );

  // C. Campos estructurados correctos, sin label concatenado.
  const account = byId.get("account-branch-a1-only");
  assert.equal(account?.bankName, "Banco Demo");
  assert.equal(account?.accountType, "monetary");
  assert.equal(account?.holderName, "FerrePharma Demo");
  assert.equal("label" in (account ?? {}), false, "CheckoutBankAccountDto no debe tener label");

  // D. Cuenta inactive no aparece.
  assert.equal(byId.has("account-inactive"), false, "Una cuenta inactive no debe aparecer en POS");

  // E. Tenant B no aparece para Tenant A.
  assert.equal(byId.has("account-tenant-b"), false, "Tenant A jamas debe recibir cuenta de Tenant B");

  // Moneda distinta a la del tenant tampoco aparece (regla ya existente, se conserva).
  assert.equal(byId.has("account-wrong-currency"), false, "La moneda debe coincidir con el tenant");

  // F. Cuenta restringida a otra sucursal no aparece; la de todas las sucursales si.
  assert.equal(
    byId.has("account-branch-a1-only"),
    true,
    "La cuenta restringida a A1 debe verse desde A1",
  );
  assert.equal(byId.has("account-all-branches"), true, "branchIds vacio = todas las sucursales");

  const forBranchA2 = await service.execute({ tenantId: TENANT_A, branchId: BRANCH_A2 });
  const idsForA2 = forBranchA2.map((item) => item.id);
  assert.equal(
    idsForA2.includes("account-branch-a1-only"),
    false,
    "Una cuenta restringida a A1 no debe verse desde A2",
  );
  assert.equal(
    idsForA2.includes("account-all-branches"),
    true,
    "branchIds vacio sigue viendose desde cualquier sucursal",
  );
}

function verifySourceInvariants() {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  // A. Administration sigue mostrando el numero enmascarado, nunca el completo.
  const bankAccountDto = read("src/modules/administration/application/dto/BankAccountDto.ts");
  assert.match(
    bankAccountDto,
    /Omit<BankAccount,\s*"tenantId"\s*\|\s*"accountNumber">/,
    "BankAccountDto de administration debe seguir excluyendo accountNumber",
  );
  const bankAccountMapper = read(
    "src/modules/administration/application/mappers/BankAccountMapper.ts",
  );
  assert.equal(
    bankAccountMapper.includes("accountNumber: account.accountNumber"),
    false,
    "El mapper de administration no debe mapear accountNumber completo",
  );
  const bankAccountTable = read("src/modules/administration/components/BankAccountTable.tsx");
  assert.equal(
    bankAccountTable.includes("account.accountNumberMasked"),
    true,
    "La tabla de administration debe renderizar accountNumberMasked",
  );
  assert.equal(
    /\{account\.accountNumber\}/.test(bankAccountTable),
    false,
    "La tabla de administration no debe renderizar accountNumber completo",
  );

  // G. El service de POS no debe exigir admin.bank_accounts.manage.
  const checkoutBankAccountsService = read(
    "src/modules/pos/application/services/GetCheckoutBankAccountsService.ts",
  );
  assert.equal(
    checkoutBankAccountsService.includes("admin.bank_accounts.manage"),
    false,
    "El cajero no debe necesitar admin.bank_accounts.manage para leer cuentas de transferencia",
  );

  // H. Copiar usa exactamente la cuenta seleccionada (no un valor global/stale).
  const checkoutModal = read("src/modules/pos/components/CheckoutModal.tsx");
  assert.equal(
    checkoutModal.includes("navigator.clipboard.writeText(account.accountNumber)"),
    true,
    "Copiar debe escribir accountNumber de la cuenta seleccionada, no un valor externo",
  );

  // I. Cash shift sigue sin exponer userId.
  const cashShiftTable = read("src/modules/administration/components/CashShiftTable.tsx");
  assert.equal(
    cashShiftTable.includes("ID de cajero"),
    false,
    "El detalle de turno no debe volver a mostrar el userId del cajero",
  );
}

async function main() {
  const harness = createHarness();
  await verifyServiceBehavior(harness);
  verifySourceInvariants();
  console.log("pos bank account transfer verification: PASS");
}

void main();
