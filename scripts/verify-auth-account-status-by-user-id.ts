/**
 * Harness de regresion para AuthRepository.getAuthAccountStatusByUserId
 * (lectura administrativa del estado de cuenta de OTRO usuario, para la
 * pantalla de Usuarios de administration -- coordinado con Jose, ver
 * docs/MODULE_OWNERSHIP.md "User/Auth": Andy + Jose).
 *
 * Foco: que el scope de tenant se respete (AuthAccount no tiene tenantId
 * propio -- vive en User), y que no filtre informacion de un tenant a
 * otro.
 *
 * Uso (desde la raiz del proyecto):
 *   npx tsx scripts/verify-auth-account-status-by-user-id.ts
 */

import { MockDatabaseStore } from "../src/infrastructure/mock/database/MockDatabaseStore";
import { DataEventBus } from "../src/infrastructure/events/DataEventBus";
import { MockAuthRepository } from "../src/infrastructure/mock/repositories/MockAuthRepository";
import { LocalStorageAdapter } from "../src/infrastructure/storage/LocalStorageAdapter";
import { AccountStatus, UserStatus, UserType } from "../src/core/enums";
import { buildPasswordHashMock } from "../src/infrastructure/mock/shared/passwordHashMock";

let failed = false;
let counter = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed = true;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`OK:   ${message}`);
  }
}

async function main() {
  const storage = new LocalStorageAdapter();
  const store = new MockDatabaseStore(storage);
  const eventBus = new DataEventBus();
  const repo = new MockAuthRepository(store, eventBus, storage);

  function createEmployee(opts: {
    tenantId: string;
    email: string;
    status: AccountStatus;
    lastLoginAt?: string;
  }) {
    counter += 1;
    const userId = `user-status-${counter}`;
    const accountId = `auth-status-${counter}`;
    store.mutate((db) => {
      db.users.push({
        id: userId,
        tenantId: opts.tenantId,
        name: `Status Test ${counter}`,
        email: opts.email,
        type: UserType.employee,
        status: UserStatus.active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.authAccounts.push({
        id: accountId,
        userId,
        email: opts.email,
        passwordHashMock: buildPasswordHashMock("SomePass123"),
        status: opts.status,
        failedLoginAttempts: 0,
        lastLoginAt: opts.lastLoginAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return undefined;
    });
    return { userId, accountId };
  }

  function enableMfaFor(userId: string) {
    counter += 1;
    store.mutate((db) => {
      db.mfaEnrollments.push({
        id: `mfa-status-${counter}`,
        userId,
        enabled: true,
        method: "totp",
        demoCodeMock: "999999",
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return undefined;
    });
  }

  console.log("\n=== A: mismo tenant, cuenta activa, sin MFA ===");
  const empA = createEmployee({
    tenantId: "tenant-status-p",
    email: "status-a@example.com",
    status: AccountStatus.active,
    lastLoginAt: "2026-01-01T00:00:00.000Z",
  });
  const resultA = await repo.getAuthAccountStatusByUserId("tenant-status-p", empA.userId);
  assert(resultA?.status === AccountStatus.active, "A: status === active");
  assert(resultA?.mfaEnabled === false, "A: mfaEnabled === false (sin enrollment)");
  assert(resultA?.lastLoginAt === "2026-01-01T00:00:00.000Z", "A: lastLoginAt se devuelve tal cual");

  console.log("\n=== B: mismo tenant, MFA activo ===");
  const empB = createEmployee({
    tenantId: "tenant-status-p",
    email: "status-b@example.com",
    status: AccountStatus.temporarily_locked,
  });
  enableMfaFor(empB.userId);
  const resultB = await repo.getAuthAccountStatusByUserId("tenant-status-p", empB.userId);
  assert(resultB?.status === AccountStatus.temporarily_locked, "B: status === temporarily_locked");
  assert(resultB?.mfaEnabled === true, "B: mfaEnabled === true");
  assert(resultB?.lastLoginAt === undefined, "B: lastLoginAt undefined (nunca inicio sesion)");

  console.log("\n=== C: BLOCKER de aislamiento -- userId de OTRO tenant -> null ===");
  const empC = createEmployee({
    tenantId: "tenant-status-q",
    email: "status-c@example.com",
    status: AccountStatus.active,
  });
  const resultC = await repo.getAuthAccountStatusByUserId("tenant-status-p", empC.userId);
  assert(
    resultC === null,
    "C: un admin del tenant P NO puede leer el estado de un usuario del tenant Q (aislamiento de tenant)",
  );

  console.log("\n=== D: userId inexistente -> null, mismo resultado que 'otro tenant' (no revela motivo) ===");
  const resultD = await repo.getAuthAccountStatusByUserId("tenant-status-p", "user-status-no-existe");
  assert(resultD === null, "D: userId inexistente -> null");

  console.log("\n=== E: User existe pero sin AuthAccount todavia -> null ===");
  counter += 1;
  const userOnlyId = `user-status-only-${counter}`;
  store.mutate((db) => {
    db.users.push({
      id: userOnlyId,
      tenantId: "tenant-status-p",
      name: "Solo User",
      email: "status-e@example.com",
      type: UserType.employee,
      status: UserStatus.active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return undefined;
  });
  const resultE = await repo.getAuthAccountStatusByUserId("tenant-status-p", userOnlyId);
  assert(resultE === null, "E: User sin AuthAccount (p.ej. recien invitado sin activar) -> null");

  console.log(failed ? "\nHay FAILs arriba, revisar." : "\nTodo OK.");
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
