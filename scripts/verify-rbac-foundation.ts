import assert from "node:assert/strict";
import type { Role, User } from "@/core/entities";
import { UserStatus, UserType } from "@/core/enums";
import { hasPermission, requireEmployeePermission } from "@/core/permissions/resolvePermission";
import { canUserAccessBranch, requireBranchAccess } from "@/core/scopes/userBranchAccess";
import { getAllPermissionKeys, permissionsConfig } from "@/config/permissions";
import { DataEventBus } from "@/infrastructure/events/DataEventBus";
import { MockDatabaseStore } from "@/infrastructure/mock/database/MockDatabaseStore";
import { MockRoleRepository } from "@/infrastructure/mock/repositories/MockRoleRepository";
import { LocalStorageAdapter } from "@/infrastructure/storage/LocalStorageAdapter";

// hasPermission: match exacto
assert.equal(hasPermission(["admin.customers.read"], "admin.customers.read"), true);

// hasPermission: manage implica read del MISMO recurso
assert.equal(hasPermission(["admin.customers.manage"], "admin.customers.read"), true);

// hasPermission: manage de un recurso NO implica read de otro
assert.equal(hasPermission(["admin.suppliers.manage"], "admin.customers.read"), false);

// hasPermission: read NO implica manage (fail-closed en la direccion inversa)
assert.equal(hasPermission(["admin.customers.read"], "admin.customers.manage"), false);

// hasPermission: permiso jamas otorgado se deniega
assert.equal(hasPermission([], "admin.customers.read"), false);

// requireEmployeePermission: no lanza si el permiso resuelve
requireEmployeePermission(["admin.customers.manage"], "admin.customers.read");

// requireEmployeePermission: lanza si no resuelve
assert.throws(() => requireEmployeePermission([], "admin.customers.manage"));

// canUserAccessBranch / requireBranchAccess: branchScope "all"
const roleAll: Role = {
  id: "role-1",
  tenantId: "tenant-a",
  name: "Todas",
  description: undefined,
  isSystem: true,
  permissions: [],
  branchScope: "all",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const userTenantA: User = {
  id: "user-1",
  tenantId: "tenant-a",
  name: "Empleado A",
  email: "a@demo.com",
  type: UserType.employee,
  status: UserStatus.active,
  roleId: "role-1",
  branchId: "branch-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
assert.equal(canUserAccessBranch(userTenantA, roleAll, "branch-999"), true);

// canUserAccessBranch: cross-tenant SIEMPRE deniega, sin importar branchScope
const roleTenantB: Role = { ...roleAll, tenantId: "tenant-b" };
assert.equal(canUserAccessBranch(userTenantA, roleTenantB, "branch-1"), false);
assert.throws(() => requireBranchAccess(userTenantA, roleTenantB, "branch-1"));

// canUserAccessBranch: "selected" respeta allowedBranchIds
const roleSelected: Role = { ...roleAll, branchScope: "selected" };
const userSelected: User = { ...userTenantA, allowedBranchIds: ["branch-1", "branch-2"] };
assert.equal(canUserAccessBranch(userSelected, roleSelected, "branch-2"), true);
assert.equal(canUserAccessBranch(userSelected, roleSelected, "branch-3"), false);

// canUserAccessBranch: "assigned" (default) exige branchId exacto
const roleAssigned: Role = { ...roleAll, branchScope: "assigned" };
assert.equal(canUserAccessBranch(userTenantA, roleAssigned, "branch-1"), true);
assert.equal(canUserAccessBranch(userTenantA, roleAssigned, "branch-2"), false);

// getAllPermissionKeys: deriva de permissionsConfig, no de una lista manual
const derivedKeys = getAllPermissionKeys();
assert.equal(derivedKeys.length, permissionsConfig.length);
assert.ok(
  derivedKeys.includes("admin.suppliers.manage"),
  "getAllPermissionKeys debe incluir los permisos reales de administration",
);

// role-super-admin-qa del seed debe tener EXACTAMENTE todos los permisos
// del catalogo -- si esto falla, alguien volvio a hardcodear la lista.
async function verifyQaRoleMatchesCatalog() {
  const store = new MockDatabaseStore(new LocalStorageAdapter());
  const roles = new MockRoleRepository(store, new DataEventBus());
  const qaRole = await roles.getById("role-super-admin-qa");
  assert.ok(qaRole, "role-super-admin-qa debe existir en el seed demo");
  assert.deepEqual(new Set(qaRole.permissions), new Set(getAllPermissionKeys()));
}

// RoleRepository.create / update / getByTenant
async function verifyRoleRepositoryCrud() {
  const store = new MockDatabaseStore(new LocalStorageAdapter());
  const roles = new MockRoleRepository(store, new DataEventBus());

  const created = await roles.create({
    tenantId: "tenant-demo",
    name: "Rol de prueba",
    isSystem: false,
    permissions: ["admin.suppliers.manage"],
    branchScope: "assigned",
  });
  assert.equal(created.tenantId, "tenant-demo");

  const otherTenantRole = await roles.create({
    tenantId: "tenant-other",
    name: "Rol de otro tenant",
    isSystem: false,
    permissions: [],
    branchScope: "all",
  });

  const tenantDemoRoles = await roles.getByTenant("tenant-demo");
  assert.ok(tenantDemoRoles.some((role) => role.id === created.id));
  assert.ok(!tenantDemoRoles.some((role) => role.id === otherTenantRole.id));

  const updated = await roles.update(created.id, { name: "Rol de prueba (editado)" });
  assert.equal(updated.name, "Rol de prueba (editado)");
  assert.equal(updated.tenantId, "tenant-demo");
}

async function main() {
  await verifyQaRoleMatchesCatalog();
  await verifyRoleRepositoryCrud();
  console.log("verify-rbac-foundation: OK");
}

void main();
