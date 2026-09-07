import { CategoryStatus } from "@/core/enums";
import type { CategoryRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockCategoryRepository extends BaseMockRepository implements CategoryRepository {
  async getAll() {
    return this.read((db) => db.categories);
  }
  async getById(id: string) {
    return this.read((db) => db.categories.find((item) => item.id === id) ?? null);
  }
  async getActive() {
    return this.read((db) => db.categories.filter((item) => item.status === "active"));
  }
  async create(input: Parameters<CategoryRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("categories"), createdAt: now, updatedAt: now };
      db.categories.push(created);
      return created;
    });
    this.emit("category.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<CategoryRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.categories, id, input, "Category"));
    this.emit("category.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async updateStatus(id: string, status: CategoryStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.categories, id, { status: status }, "Category"),
    );
    this.emit("category.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
  async archive(id: string) {
    const item = this.store.mutate((db) =>
      this.updateById(db.categories, id, { status: CategoryStatus.archived }, "Category"),
    );
    this.emit("category.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "archived",
    });
    return item;
  }
}
