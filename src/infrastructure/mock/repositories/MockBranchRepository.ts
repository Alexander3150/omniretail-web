import { BranchStatus } from "@/core/enums";
import type { BranchRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockBranchRepository extends BaseMockRepository implements BranchRepository {
  async getAll() {
    return this.read((db) => db.branches);
  }
  async getById(id: string) {
    return this.read((db) => db.branches.find((item) => item.id === id) ?? null);
  }
  async getActive() {
    return this.read((db) => db.branches.filter((item) => item.status === BranchStatus.active));
  }
  async create(input: Parameters<BranchRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("branch"), createdAt: now, updatedAt: now };
      db.branches.push(created);
      return created;
    });
    this.emit("branch.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
  async update(id: string, input: Parameters<BranchRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.branches, id, input, "Branch"));
    this.emit("branch.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }
}
