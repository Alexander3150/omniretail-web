import type { UserRepository } from "@/core/repositories";
import type { UserStatus } from "@/core/enums";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockUserRepository extends BaseMockRepository implements UserRepository {
  async getAll() {
    return this.read((db) => db.users);
  }
  async getById(id: string) {
    return this.read((db) => db.users.find((item) => item.id === id) ?? null);
  }
  async getByEmail(email: string) {
    return this.read(
      (db) => db.users.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null,
    );
  }
  async create(input: Parameters<UserRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("user"), createdAt: now, updatedAt: now };
      db.users.push(created);
      return created;
    });
    this.emit("user.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
  async update(id: string, input: Parameters<UserRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.users, id, input, "User"));
    this.emit("user.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }
  async updateStatus(id: string, status: UserStatus) {
    return this.update(id, { status });
  }
}
