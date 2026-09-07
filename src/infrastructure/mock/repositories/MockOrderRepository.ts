import { OrderStatus } from "@/core/enums";
import type { OrderRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
const logisticsStatuses = new Set<OrderStatus>([
  OrderStatus.confirmed,
  OrderStatus.preparing,
  OrderStatus.picking,
  OrderStatus.packing,
  OrderStatus.ready_for_dispatch,
]);
export class MockOrderRepository extends BaseMockRepository implements OrderRepository {
  async getAll() {
    return this.read((db) => db.orders);
  }
  async getById(id: string) {
    return this.read((db) => db.orders.find((item) => item.id === id) ?? null);
  }
  async getByTrackingToken(trackingToken: string) {
    return this.read(
      (db) => db.orders.find((item) => item.trackingToken === trackingToken) ?? null,
    );
  }
  async getByCustomer(customerId: string) {
    return this.read((db) => db.orders.filter((item) => item.customerId === customerId));
  }
  async getPendingForLogistics() {
    return this.read((db) => db.orders.filter((item) => logisticsStatuses.has(item.status)));
  }
  async create(input: Parameters<OrderRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("order"), createdAt: now, updatedAt: now };
      db.orders.push(created);
      return created;
    });
    this.emit("order.changed", { entityId: item.id, tenantId: item.tenantId, action: "created" });
    return item;
  }
  async updateStatus(id: string, status: OrderStatus) {
    const item = this.store.mutate((db) => this.updateById(db.orders, id, { status }, "Order"));
    this.emit("order.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "status_changed",
    });
    return item;
  }
}
