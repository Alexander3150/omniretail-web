import type { SavedPaymentMethodRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockSavedPaymentMethodRepository
  extends BaseMockRepository
  implements SavedPaymentMethodRepository
{
  async getByCustomer(customerId: string) {
    return this.read((db) =>
      db.savedPaymentMethods.filter((item) => item.customerId === customerId),
    );
  }
  async add(input: Parameters<SavedPaymentMethodRepository["add"]>[0]) {
    const item = this.store.mutate((db) => {
      const created = { ...input, id: this.id("payment-method"), createdAt: this.now() };
      if (created.isDefault)
        db.savedPaymentMethods.forEach((method) => {
          if (method.customerId === created.customerId) method.isDefault = false;
        });
      db.savedPaymentMethods.push(created);
      return created;
    });
    this.emit("customer.changed", { entityId: item.customerId, action: "updated" });
    return item;
  }
  async remove(id: string) {
    this.store.mutate((db) => {
      db.savedPaymentMethods = db.savedPaymentMethods.filter((item) => item.id !== id);
      return undefined;
    });
    this.emit("customer.changed", { action: "deleted" });
  }
  async setDefault(customerId: string, id: string) {
    const item = this.store.mutate((db) => {
      db.savedPaymentMethods.forEach((method) => {
        if (method.customerId === customerId) method.isDefault = method.id === id;
      });
      const selected = db.savedPaymentMethods.find((method) => method.id === id);
      if (!selected) throw this.missing("SavedPaymentMethod", id);
      return selected;
    });
    this.emit("customer.changed", { entityId: customerId, action: "updated" });
    return item;
  }
}
