import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AccountStatus, BranchStatus, BranchType, CustomerStatus, RoleStatus, UserStatus, UserType } from "@/core/enums";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import {
  MockAuditLogRepository,
  MockAuthRepository,
  MockBranchRepository,
  MockCustomerRepository,
  MockRoleRepository,
  MockUserRepository,
} from "@/infrastructure/mock/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import type { EmployeeInputDto } from "@/modules/administration/application/dto/EmployeeDto";
import { CreateEmployeeService } from "@/modules/administration/application/services/CreateEmployeeService";
import { GetEmployeesService } from "@/modules/administration/application/services/GetEmployeesService";
import { UpdateEmployeeService } from "@/modules/administration/application/services/UpdateEmployeeService";

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

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const NOW = "2026-01-01T00:00:00.000Z";
const TENANT_A = "admin-users-tenant-a";
const TENANT_B = "admin-users-tenant-b";
const ACTOR_ID = "admin-users-actor";
const READ_PERMISSION = "admin.users.read";
const MANAGE_PERMISSION = "admin.users.manage";
// Permisos "efectivos" del actor en la mayoría de los tests -- delibradamente limitados, para
// poder probar que no puede delegar más de esto.
const ACTOR_PERMISSIONS = [MANAGE_PERMISSION, "catalog.products.read"];

function createHarness() {
  const store = new MockDatabaseStore(new MemoryStorageAdapter());
  const eventBus = new DataEventBus();

  store.mutate((db) => {
    db.branches = [
      ...db.branches,
      {
        id: "au-branch-a1",
        tenantId: TENANT_A,
        code: "AU-A1",
        name: "Sucursal A1",
        type: BranchType.store,
        status: BranchStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-branch-a2-inactive",
        tenantId: TENANT_A,
        code: "AU-A2",
        name: "Sucursal A2 inactiva",
        type: BranchType.store,
        status: BranchStatus.inactive,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-branch-b1",
        tenantId: TENANT_B,
        code: "AU-B1",
        name: "Sucursal B1",
        type: BranchType.store,
        status: BranchStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    db.roles = [
      ...db.roles,
      {
        id: "au-role-ok",
        tenantId: TENANT_A,
        name: "Rol delegable",
        isSystem: false,
        permissions: ["catalog.products.read"],
        branchScope: "assigned",
        status: RoleStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-role-system-ok",
        tenantId: TENANT_A,
        name: "Rol de sistema delegable",
        isSystem: true,
        permissions: ["catalog.products.read"],
        branchScope: "all",
        status: RoleStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-role-escalation",
        tenantId: TENANT_A,
        name: "Rol con más permisos que el actor",
        isSystem: false,
        permissions: ["catalog.products.read", "admin.reports.export"],
        branchScope: "assigned",
        status: RoleStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-role-archived",
        tenantId: TENANT_A,
        name: "Rol archivado",
        isSystem: false,
        permissions: ["catalog.products.read"],
        branchScope: "assigned",
        status: RoleStatus.archived,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-role-inactive",
        tenantId: TENANT_A,
        name: "Rol inactivo",
        isSystem: false,
        permissions: ["catalog.products.read"],
        branchScope: "assigned",
        status: RoleStatus.inactive,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-role-tenant-b",
        tenantId: TENANT_B,
        name: "Rol de otro tenant",
        isSystem: false,
        permissions: [],
        branchScope: "assigned",
        status: RoleStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    db.users = [
      ...db.users,
      {
        id: "au-employee-a1",
        tenantId: TENANT_A,
        name: "Empleado A1",
        email: "au-employee-a1@example.test",
        type: UserType.employee,
        status: UserStatus.active,
        roleId: "au-role-ok",
        allowedBranchIds: ["au-branch-a1"],
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-employee-b1",
        tenantId: TENANT_B,
        name: "Empleado B1",
        email: "au-employee-b1@example.test",
        type: UserType.employee,
        status: UserStatus.active,
        roleId: "au-role-tenant-b",
        allowedBranchIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-customer-a1",
        tenantId: TENANT_A,
        customerId: "au-customer-entity-a1",
        name: "Cliente A1",
        email: "au-customer-a1@example.test",
        type: UserType.customer,
        status: UserStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "au-employee-duplicate-email",
        tenantId: TENANT_B,
        name: "Empleado con email ya usado",
        email: "au-existing@example.test",
        type: UserType.employee,
        status: UserStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    db.customers = [
      ...db.customers,
      {
        id: "au-customer-entity-a1",
        tenantId: TENANT_A,
        code: "AU-CUST-1",
        name: "Cliente A1",
        email: "au-customer-a1@example.test",
        status: CustomerStatus.active,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    db.authAccounts = [
      ...db.authAccounts,
      {
        id: "au-account-a1",
        userId: "au-employee-a1",
        email: "au-employee-a1@example.test",
        passwordHashMock: "hash",
        status: AccountStatus.active,
        failedLoginAttempts: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
  });

  const roles = new MockRoleRepository(store, eventBus);
  const branches = new MockBranchRepository(store, eventBus);
  const users = new MockUserRepository(store, eventBus);
  const auth = new MockAuthRepository(store, eventBus, new MemoryStorageAdapter());
  const customers = new MockCustomerRepository(store, eventBus);
  const auditLogs = new MockAuditLogRepository(store, eventBus);

  return {
    repositories: {
      roles,
      branches,
      users,
      auth,
      customers,
      auditLogs,
    } as unknown as RepositoryRegistry,
    store,
  };
}

function baseInput(overrides: Partial<EmployeeInputDto> = {}): EmployeeInputDto {
  return {
    name: "Nuevo Empleado",
    email: `au-new-${Math.random().toString(36).slice(2)}@example.test`,
    phone: undefined,
    roleId: "au-role-ok",
    allowedBranchIds: ["au-branch-a1"],
    status: UserStatus.active,
    ...overrides,
  };
}

async function verifyListingAndScope(harness: ReturnType<typeof createHarness>) {
  const service = new GetEmployeesService(harness.repositories);
  const employees = await service.execute(TENANT_A, [READ_PERMISSION]);
  const ids = employees.map((item) => item.id);

  // Tenant A lista sólo Employee A.
  assert.ok(ids.includes("au-employee-a1"));
  // Tenant A no lee Employee B.
  assert.equal(ids.includes("au-employee-b1"), false);
  // Customer excluded.
  assert.equal(ids.includes("au-customer-a1"), false);
}

async function verifyCreateEmployee(harness: ReturnType<typeof createHarness>) {
  const service = new CreateEmployeeService(harness.repositories);

  // create employee same tenant -- inviteEmployee invoked correctamente.
  const created = await service.execute(
    TENANT_A,
    baseInput(),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  const account = harness.store
    .getSnapshot()
    .authAccounts.find((item) => item.userId === created.id);
  assert.ok(account, "inviteEmployee debe haber creado un AuthAccount para el nuevo empleado");
  assert.equal(account?.status, AccountStatus.password_reset_required);

  // duplicate email rejected según la política real de Auth (global, misma fuente que login()).
  await assert.rejects(
    () => service.execute(TENANT_A, baseInput({ email: "au-existing@example.test" }), ACTOR_PERMISSIONS, ACTOR_ID),
    /ya existe/i,
  );

  // valid role assignment ya se probó arriba (au-role-ok). cross-tenant Role denied:
  await assert.rejects(
    () => service.execute(TENANT_A, baseInput({ roleId: "au-role-tenant-b" }), ACTOR_PERMISSIONS, ACTOR_ID),
    /no está disponible/i,
  );

  // archived Role denied.
  await assert.rejects(
    () => service.execute(TENANT_A, baseInput({ roleId: "au-role-archived" }), ACTOR_PERMISSIONS, ACTOR_ID),
    /solo se pueden asignar roles activos/i,
  );

  // inactive Role denied (§8: preferencia explícita).
  await assert.rejects(
    () => service.execute(TENANT_A, baseInput({ roleId: "au-role-inactive" }), ACTOR_PERMISSIONS, ACTOR_ID),
    /solo se pueden asignar roles activos/i,
  );

  // privilege escalation Role denied + direct service bypass denied (misma llamada: no hay una
  // "UI" separada del service en esta arquitectura, el service ES el boundary).
  await assert.rejects(
    () => service.execute(TENANT_A, baseInput({ roleId: "au-role-escalation" }), ACTOR_PERMISSIONS, ACTOR_ID),
    /no podés asignar un rol/i,
  );

  // isSystem role SÍ es asignable si es delegable, activo, mismo tenant.
  const withSystemRole = await service.execute(
    TENANT_A,
    baseInput({ roleId: "au-role-system-ok" }),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  assert.equal(withSystemRole.roleId, "au-role-system-ok");

  // Branch same tenant accepted (ya probado en baseInput). cross-tenant Branch denied:
  await assert.rejects(
    () =>
      service.execute(
        TENANT_A,
        baseInput({ allowedBranchIds: ["au-branch-b1"] }),
        ACTOR_PERMISSIONS,
        ACTOR_ID,
      ),
    /no existe o no pertenece/i,
  );

  // invalid Branch denied (inexistente).
  await assert.rejects(
    () =>
      service.execute(
        TENANT_A,
        baseInput({ allowedBranchIds: ["au-branch-does-not-exist"] }),
        ACTOR_PERMISSIONS,
        ACTOR_ID,
      ),
    /no existe o no pertenece/i,
  );

  return created;
}

async function verifyUpdateEmployeeAndRevocation(harness: ReturnType<typeof createHarness>) {
  const service = new UpdateEmployeeService(harness.repositories);
  const auth = harness.repositories.auth;

  function activeSessionCount(userId: string): number {
    return harness.store
      .getSnapshot()
      .sessions.filter((item) => item.userId === userId && !item.revokedAt).length;
  }

  // Sesiones iniciales para au-employee-a1.
  harness.store.mutate((db) => {
    db.sessions.push(
      { id: "au-session-1", userId: "au-employee-a1", createdAt: NOW, expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false },
      { id: "au-session-2", userId: "au-employee-a1", createdAt: NOW, expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false },
    );
  });
  assert.equal(activeSessionCount("au-employee-a1"), 2);

  // unchanged nonsecurity update (solo nombre) NO debe revocar nada.
  await service.execute(
    TENANT_A,
    "au-employee-a1",
    baseInput({
      name: "Empleado A1 Renombrado",
      roleId: "au-role-ok",
      allowedBranchIds: ["au-branch-a1"],
      status: UserStatus.active,
    }),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  assert.equal(activeSessionCount("au-employee-a1"), 2, "Un update de solo nombre no debe revocar sesiones");

  // Role change revokes sessions.
  await service.execute(
    TENANT_A,
    "au-employee-a1",
    baseInput({ roleId: "au-role-system-ok", allowedBranchIds: ["au-branch-a1"], status: UserStatus.active }),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  assert.equal(activeSessionCount("au-employee-a1"), 0, "Cambiar de Role debe revocar todas las sesiones");

  // Nuevas sesiones para probar el siguiente disparador.
  harness.store.mutate((db) => {
    db.sessions.push({ id: "au-session-3", userId: "au-employee-a1", createdAt: NOW, expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false });
  });
  assert.equal(activeSessionCount("au-employee-a1"), 1);

  // Branch change revokes sessions.
  await service.execute(
    TENANT_A,
    "au-employee-a1",
    baseInput({ roleId: "au-role-system-ok", allowedBranchIds: [], status: UserStatus.active }),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  assert.equal(activeSessionCount("au-employee-a1"), 0, "Cambiar sucursales asignadas debe revocar sesiones");

  harness.store.mutate((db) => {
    db.sessions.push({ id: "au-session-4", userId: "au-employee-a1", createdAt: NOW, expiresAt: "2099-01-01T00:00:00.000Z", rememberMe: false });
  });

  // User inactive (status change) revokes sessions.
  await service.execute(
    TENANT_A,
    "au-employee-a1",
    baseInput({ roleId: "au-role-system-ok", allowedBranchIds: [], status: UserStatus.inactive }),
    ACTOR_PERMISSIONS,
    ACTOR_ID,
  );
  assert.equal(activeSessionCount("au-employee-a1"), 0, "Inactivar el empleado debe revocar sesiones");

  void auth;
}

function verifyNoDirectAuthAccountCreation() {
  const source = stripComments(
    readFileSync(
      join(process.cwd(), "src/modules/administration/application/services/CreateEmployeeService.ts"),
      "utf8",
    ),
  );
  assert.equal(
    /authAccounts\s*\.\s*push|db\.authAccounts/.test(source),
    false,
    "CreateEmployeeService no debe crear AuthAccount directamente -- debe reutilizar inviteEmployee",
  );
  assert.ok(
    /inviteEmployee/.test(source),
    "CreateEmployeeService debe reutilizar AuthRepository.inviteEmployee",
  );
}

async function main() {
  const harness = createHarness();
  await verifyListingAndScope(harness);
  await verifyCreateEmployee(createHarness());
  await verifyUpdateEmployeeAndRevocation(createHarness());
  verifyNoDirectAuthAccountCreation();
  console.log("admin users verification: PASS");
}

void main();
