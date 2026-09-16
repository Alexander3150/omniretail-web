import assert from "node:assert/strict";
import { BranchStatus, BranchType, PlanCode, SaasCapabilityKey, UserStatus } from "@/core/enums";
import { permissionsConfig } from "@/config/permissions";
import { subscriptionTotalQuetzales } from "@/core/subscription/catalog";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { createMockDatabase } from "@/infrastructure/mock/database/createMockDatabase";
import {
  MockAuditLogRepository, MockBranchRepository, MockBusinessConfigRepository,
  MockPlanRepository, MockTenantSubscriptionRepository, MockUserRepository,
  MockRoleRepository,
} from "@/infrastructure/mock/repositories";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";
import { MOCK_DATABASE_STORAGE_KEY } from "@/infrastructure/storage/storageKeys";
import { GetTenantSubscriptionDetailsService } from "@/modules/administration/application/services/GetTenantSubscriptionDetailsService";
import { getBillingCycle } from "@/modules/administration/application/services/subscriptionBilling";
import { UpdateTenantSubscriptionService } from "@/modules/administration/application/services/UpdateTenantSubscriptionService";
import { GetReportsService } from "@/modules/administration/application/services/GetReportsService";
import { DispatchApplicationService } from "@/modules/logistics/application/services/DispatchApplicationService";
import { CreateEmployeeService } from "@/modules/administration/application/services/CreateEmployeeService";
import { CreateBranchService } from "@/modules/administration/application/services/CreateBranchService";
import { ResolveTenantEntitlementsService } from "@/shared/application/services/ResolveTenantEntitlementsService";

class MemoryStorage extends LocalStorageAdapter {
  readonly values = new Map<string, unknown>();
  override get<T>(key: string): T | null { return (this.values.get(key) as T | undefined) ?? null; }
  override set<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); }
}

async function main() {
  assert.equal(subscriptionTotalQuetzales([]), 199);
  assert.equal(subscriptionTotalQuetzales(["ecommerce_delivery"]), 328);
  assert.equal(subscriptionTotalQuetzales(["advanced_reports"]), 298);
  assert.equal(subscriptionTotalQuetzales(["ecommerce_delivery", "advanced_reports"]), 427);
  assert.equal(getBillingCycle("2026-01-31T00:00:00.000Z", new Date("2026-02-28T12:00:00.000Z")).nextRenewalAt, "2026-03-31T00:00:00.000Z");

  const storage = new MemoryStorage();
  const legacy = createMockDatabase();
  legacy.planDefinitions.find((plan) => plan.code === PlanCode.basic)!.limits = { maxEmployees: 3, maxBranches: 1 };
  legacy.tenantSubscriptions[0].planId = "plan-enterprise";
  legacy.tenantSubscriptions[0].addonCodes = undefined;
  delete (legacy as Partial<typeof legacy>).subscriptionInvoices;
  storage.set(MOCK_DATABASE_STORAGE_KEY, legacy);
  const store = new MockDatabaseStore(storage);
  const migrated = store.getSnapshot();
  assert.equal(migrated.tenantSubscriptions[0].planId, "plan-basic");
  assert.deepEqual(migrated.tenantSubscriptions[0].addonCodes, ["ecommerce_delivery", "advanced_reports"]);
  assert.deepEqual(createMockDatabase().planDefinitions.find((plan) => plan.code === PlanCode.basic)?.limits, {});
  assert.deepEqual(migrated.planDefinitions.find((plan) => plan.code === PlanCode.basic)?.limits, {});
  assert.deepEqual(migrated.subscriptionInvoices, []);
  store.mutate((db) => {
    db.tenants.push({ ...db.tenants[0], id: "another-tenant", slug: "another-tenant" });
    db.branches.push({ ...db.branches[0], id: "another-branch", tenantId: "another-tenant", code: "OTHER" });
    db.roles.push({ ...db.roles.find((role) => role.id === "role-admin")!, id: "another-role", tenantId: "another-tenant" });
    db.users.push({ ...db.users.find((user) => user.id === "user-admin")!, id: "another-user", tenantId: "another-tenant", roleId: "another-role", email: "other@tenant.demo", branchId: "another-branch", allowedBranchIds: ["another-branch"] });
    db.tenantSubscriptions.push({ ...db.tenantSubscriptions[0], id: "another-subscription", tenantId: "another-tenant", addonCodes: [] });
  });

  const events = new DataEventBus();
  const repositories = {
    plans: new MockPlanRepository(store, events),
    tenantSubscriptions: new MockTenantSubscriptionRepository(store, events),
    users: new MockUserRepository(store, events),
    branches: new MockBranchRepository(store, events),
    businessConfig: new MockBusinessConfigRepository(store, events),
    auditLogs: new MockAuditLogRepository(store, events),
    roles: new MockRoleRepository(store, events),
    auth: {
      getCurrentSessionId: async () => "session-demo",
      getSession: async () => ({ id: "session-demo", userId: "user-admin", expiresAt: "2099-01-01T00:00:00.000Z" }),
      inviteEmployee: async () => ({ invitationToken: "demo-invitation" }),
    },
    orders: { listByBranch: async () => [] },
  } as unknown as RepositoryRegistry;
  const read = new GetTenantSubscriptionDetailsService(repositories);
  const manage = new UpdateTenantSubscriptionService(repositories);
  const permissions = ["admin.plans.read", "admin.plans.manage"];
  const adminPermissions = permissionsConfig.map((permission) => permission.key);
  const employeesBefore = (await repositories.users.listByTenant("tenant-demo")).filter((user) => user.type === "employee").length;
  const branchesBefore = (await repositories.branches.listByTenant("tenant-demo")).length;
  assert(employeesBefore >= 3 && branchesBefore >= 1);
  const employeeInput = {
    name: "Empleado sin cupo",
    email: "sin-cupo@ferrepharma.demo",
    roleId: "role-cashier",
    allowedBranchIds: ["branch-centro"],
    status: UserStatus.active,
  };
  const branchInput = {
    code: "SIN-CUPO",
    name: "Sucursal sin cupo",
    type: BranchType.store,
    status: BranchStatus.active,
  };
  await assert.rejects(() => new CreateEmployeeService(repositories).execute("tenant-demo", employeeInput, [], "user-admin"));
  await assert.rejects(() => new CreateEmployeeService(repositories).execute("tenant-demo", { ...employeeInput, email: "invalido" }, adminPermissions, "user-admin"));
  await assert.rejects(() => new CreateBranchService(repositories).execute("tenant-demo", branchInput, [], "user-admin"));
  await new CreateEmployeeService(repositories).execute("tenant-demo", employeeInput, adminPermissions, "user-admin");
  await new CreateBranchService(repositories).execute("tenant-demo", branchInput, adminPermissions, "user-admin");
  assert.equal((await repositories.users.listByTenant("tenant-demo")).filter((user) => user.type === "employee").length, employeesBefore + 1);
  assert.equal((await repositories.branches.listByTenant("tenant-demo")).length, branchesBefore + 1);
  assert.equal((await repositories.users.listByTenant("another-tenant")).length, 1);
  assert.equal((await repositories.branches.listByTenant("another-tenant")).length, 1);
  const before = await read.execute("tenant-demo", permissions);
  assert.equal(before.usage.find((item) => item.key === "maxEmployees")?.limit, null);
  assert.equal(before.usage.find((item) => item.key === "maxBranches")?.limit, null);
  const firstInvoice = before.invoices[0];
  assert.equal(firstInvoice.totalQuetzales, 427);
  assert.equal((await read.execute("tenant-demo", permissions)).invoices.length, 1);
  // Un caller de mutación sin lectura previa conserva el precio del ciclo vigente.
  store.mutate((db) => { db.subscriptionInvoices = []; });
  await manage.execute("tenant-demo", ["ecommerce_delivery"], permissions, "user-admin");
  const after = await read.execute("tenant-demo", permissions);
  assert.deepEqual(after.addonCodes, ["ecommerce_delivery"]);
  assert.equal(after.invoices.length, 1);
  assert.equal(after.invoices[0].totalQuetzales, 427);
  const entitlements = await new ResolveTenantEntitlementsService(repositories).execute("tenant-demo");
  assert(entitlements.effectiveCapabilities.includes(SaasCapabilityKey.delivery));
  assert(!entitlements.effectiveCapabilities.includes(SaasCapabilityKey.advancedReports));
  const reports = new GetReportsService(repositories);
  await assert.rejects(() => reports.authorizeExport());
  await assert.rejects(() => reports.execute());
  const dispatch = new DispatchApplicationService(repositories);
  assert.deepEqual(await dispatch.getPreparedQueue("branch-centro"), []);
  await manage.execute("tenant-demo", ["advanced_reports"], permissions, "user-admin");
  // Dejar de contratar entregas no bloquea una obligación logística ya existente.
  assert.deepEqual(await dispatch.getPreparedQueue("branch-centro"), []);
  assert.equal(await reports.authorizeExport(), "tenant-demo");
  await assert.rejects(() => manage.execute("tenant-demo", ["advanced_reports"], ["admin.plans.read"], "user-admin"));
  await assert.rejects(() => manage.execute("tenant-demo", ["invalid"], permissions, "user-admin"));
  assert.deepEqual(await repositories.tenantSubscriptions.listInvoices("another-tenant"), []);
  console.log("verify-subscription-catalog: ALL PASS");
}

void main();
