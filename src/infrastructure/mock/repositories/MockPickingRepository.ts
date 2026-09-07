import { PickingStatus } from "@/core/enums";
import type { PickingRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockPickingRepository extends BaseMockRepository implements PickingRepository {
  async getAll() {
    return this.read((db) => db.pickingOrders);
  }
  async getById(id: string) {
    return this.read((db) => db.pickingOrders.find((item) => item.id === id) ?? null);
  }
  async getByOrder(orderId: string) {
    return this.read((db) => db.pickingOrders.find((item) => item.orderId === orderId) ?? null);
  }
  async getQueue() {
    return this.read((db) =>
      db.pickingOrders.filter((item) =>
        [PickingStatus.pending, PickingStatus.assigned, PickingStatus.in_progress].includes(
          item.status,
        ),
      ),
    );
  }
  async create(input: Parameters<PickingRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("picking"), createdAt: now, updatedAt: now };
      db.pickingOrders.push(created);
      return created;
    });
    this.emit("picking.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
  async assign(id: string, userId: string) {
    const item = this.store.mutate((db) =>
      this.updateById(
        db.pickingOrders,
        id,
        { assignedUserId: userId, status: PickingStatus.assigned },
        "PickingOrder",
      ),
    );
    this.emit("picking.changed", { entityId: item.id, tenantId: item.tenantId, action: "updated" });
    return item;
  }
  async updateStatus(id: string, status: PickingStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.pickingOrders, id, { status }, "PickingOrder"),
    );
    this.emit("picking.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "status_changed",
    });
    return item;
  }
  async updateItem(id: string, input: Parameters<PickingRepository["updateItem"]>[1]) {
    const item = this.store.mutate((db) =>
      this.updateById(db.pickingItems, id, input, "PickingItem"),
    );
    this.emit("picking.changed", { entityId: item.pickingOrderId, action: "updated" });
    return item;
  }
}
