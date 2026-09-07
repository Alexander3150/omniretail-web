import type { CustomerRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockCustomerRepository extends BaseMockRepository implements CustomerRepository {
  async getAll() {
    return this.read((db) => db.customers);
  }
  async getById(id: string) {
    return this.read((db) => db.customers.find((item) => item.id === id) ?? null);
  }
  async getByUserId(userId: string) {
    return this.read((db) => db.customers.find((item) => item.userId === userId) ?? null);
  }
  async getByEmail(email: string) {
    return this.read(
      (db) => db.customers.find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null,
    );
  }
  async create(input: Parameters<CustomerRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("customers"), createdAt: now, updatedAt: now };
      db.customers.push(created);
      return created;
    });
    this.emit("customer.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<CustomerRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.customers, id, input, "Customer"));
    this.emit("customer.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
}
