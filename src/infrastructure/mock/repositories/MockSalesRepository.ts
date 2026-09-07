import { SaleStatus } from "@/core/enums";
import type { SalesRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockSalesRepository extends BaseMockRepository implements SalesRepository {
  async getAll() {
    return this.read((db) => db.sales);
  }
  async getById(id: string) {
    return this.read((db) => db.sales.find((item) => item.id === id) ?? null);
  }
  async create(input: Parameters<SalesRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("sales"), createdAt: now, updatedAt: now };
      db.sales.push(created);
      return created;
    });
    this.emit("sale.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async updateStatus(id: string, status: SaleStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.sales, id, { status: status }, "Sale"),
    );
    this.emit("sale.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
}
