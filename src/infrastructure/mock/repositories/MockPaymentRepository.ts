import { PaymentStatus } from "@/core/enums";
import type { PaymentRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockPaymentRepository extends BaseMockRepository implements PaymentRepository {
  async getAll() {
    return this.read((db) => db.payments);
  }
  async getById(id: string) {
    return this.read((db) => db.payments.find((item) => item.id === id) ?? null);
  }
  async getByOrder(orderId: string) {
    return this.read((db) => db.payments.filter((item) => item.orderId === orderId));
  }
  async getBySale(saleId: string) {
    return this.read((db) => db.payments.filter((item) => item.saleId === saleId));
  }
  async create(input: Parameters<PaymentRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("payments"), createdAt: now };
      db.payments.push(created);
      return created;
    });
    this.emit("payment.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async updateStatus(id: string, status: PaymentStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.payments, id, { status: status }, "Payment"),
    );
    this.emit("payment.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
}
