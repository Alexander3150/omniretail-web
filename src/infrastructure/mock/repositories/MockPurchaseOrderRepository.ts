import { PurchaseOrderStatus } from "@/core/enums";
import type { PurchaseOrder } from "@/core/entities";
import type { PurchaseOrderRepository } from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockPurchaseOrderRepository
  extends BaseMockRepository
  implements PurchaseOrderRepository
{
  async getAll() {
    return this.read((db) => db.purchaseOrders.map((order) => hydratePurchaseOrder(order, db)));
  }
  async getById(id: string) {
    return this.read((db) => {
      const order = db.purchaseOrders.find((item) => item.id === id);
      return order ? hydratePurchaseOrder(order, db) : null;
    });
  }
  async create(input: Parameters<PurchaseOrderRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const { items = [], number, ...orderInput } = input;
      const created = {
        ...orderInput,
        id: this.id("purchaseOrders"),
        number: number ?? nextPurchaseOrderNumber(db),
        createdAt: now,
        updatedAt: now,
      };
      db.purchaseOrders.push(created);
      const createdItems = items.map((orderItem) => ({
        ...orderItem,
        id: this.id("purchase-order-item"),
        purchaseOrderId: created.id,
      }));
      db.purchaseOrderItems.push(...createdItems);
      return { ...created, items: createdItems };
    });
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<PurchaseOrderRepository["update"]>[1]) {
    const item = this.store.mutate((db) => {
      const { items, ...orderInput } = input;
      const updated = this.updateById(db.purchaseOrders, id, orderInput, "PurchaseOrder");
      if (items) {
        db.purchaseOrderItems = db.purchaseOrderItems.filter(
          (orderItem) => orderItem.purchaseOrderId !== id,
        );
        db.purchaseOrderItems.push(
          ...items.map((orderItem) => ({
            ...orderItem,
            id: this.id("purchase-order-item"),
            purchaseOrderId: id,
          })),
        );
      }
      return hydratePurchaseOrder(updated, db);
    });
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async updateStatus(id: string, status: PurchaseOrderStatus) {
    const item = this.store.mutate((db) =>
      hydratePurchaseOrder(
        this.updateById(db.purchaseOrders, id, { status: status }, "PurchaseOrder"),
        db,
      ),
    );
    this.emit("purchase-order.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
}

function hydratePurchaseOrder(order: PurchaseOrder, db: MockDatabase): PurchaseOrder {
  return {
    ...order,
    items: db.purchaseOrderItems.filter((item) => item.purchaseOrderId === order.id),
  };
}

function nextPurchaseOrderNumber(db: MockDatabase) {
  const next = db.purchaseOrders.reduce((max, order) => {
    const match = /^OC-(\d+)$/.exec(order.number);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `OC-${String(next).padStart(3, "0")}`;
}
