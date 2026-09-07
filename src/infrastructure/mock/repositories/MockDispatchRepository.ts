import { DispatchStatus } from "@/core/enums";
import type { DispatchRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockDispatchRepository extends BaseMockRepository implements DispatchRepository {
  async getAll() {
    return this.read((db) => db.dispatches);
  }
  async getById(id: string) {
    return this.read((db) => db.dispatches.find((item) => item.id === id) ?? null);
  }
  async getByOrder(orderId: string) {
    return this.read((db) => db.dispatches.find((item) => item.orderId === orderId) ?? null);
  }
  async create(input: Parameters<DispatchRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("dispatches"), createdAt: now, updatedAt: now };
      db.dispatches.push(created);
      return created;
    });
    this.emit("dispatch.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<DispatchRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.dispatches, id, input, "Dispatch"));
    this.emit("dispatch.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async updateStatus(id: string, status: DispatchStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.dispatches, id, { status: status }, "Dispatch"),
    );
    this.emit("dispatch.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    this.emit("order.changed", {
      entityId: item.orderId,
      tenantId: item.tenantId,
      action: "updated",
    });
    return item;
  }
}
