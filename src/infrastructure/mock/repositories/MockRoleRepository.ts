import type { RoleRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockRoleRepository extends BaseMockRepository implements RoleRepository {
  async getById(id: string) {
    return this.read((db) => db.roles.find((item) => item.id === id) ?? null);
  }
  async getByTenant(tenantId: string) {
    return this.read((db) => db.roles.filter((item) => item.tenantId === tenantId));
  }
  async create(input: Parameters<RoleRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("roles"), createdAt: now, updatedAt: now };
      db.roles.push(created);
      return created;
    });
    this.emit("role.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
  async update(id: string, input: Parameters<RoleRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.roles, id, input, "Role"));
    this.emit("role.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }
}
