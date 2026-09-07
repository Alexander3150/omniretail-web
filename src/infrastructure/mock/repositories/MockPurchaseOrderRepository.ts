import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrderRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockPurchaseOrderRepository
  extends BaseMockRepository
  implements PurchaseOrderRepository
{
  async getAll() {
    return this.read((db) => db.purchaseOrders);
  }
  async getById(id: string) {
    return this.read((db) => db.purchaseOrders.find((item) => item.id === id) ?? null);
  }
  async create(input: Parameters<PurchaseOrderRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("purchaseOrders"), createdAt: now, updatedAt: now };
      db.purchaseOrders.push(created);
      return created;
    });
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<PurchaseOrderRepository["update"]>[1]) {
    const item = this.store.mutate((db) =>
      this.updateById(db.purchaseOrders, id, input, "PurchaseOrder"),
    );
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async updateStatus(id: string, status: PurchaseOrderStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.purchaseOrders, id, { status: status }, "PurchaseOrder"),
    );
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
}
