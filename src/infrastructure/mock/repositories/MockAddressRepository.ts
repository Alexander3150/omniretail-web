import type {
  AddressRepository,
  CreateAddressInput,
  UpdateAddressInput,
} from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockAddressRepository extends BaseMockRepository implements AddressRepository {
  async getByCustomer(customerId: string) {
    return this.read((db) => db.addresses.filter((item) => item.customerId === customerId));
  }

  async getById(id: string) {
    return this.read((db) => db.addresses.find((item) => item.id === id) ?? null);
  }

  async create(input: CreateAddressInput) {
    this.assertValidAddress(input);
    const item = this.store.mutate((db) => {
      this.assertCustomerExists(input.customerId, db);
      // Primera direccion del cliente: siempre queda predeterminada, sin
      // importar lo que haya pedido el caller -- nunca puede haber cero
      // direcciones predeterminadas si al menos una existe.
      const isFirstForCustomer = !db.addresses.some(
        (address) => address.customerId === input.customerId,
      );
      const isDefault = isFirstForCustomer ? true : Boolean(input.isDefault);
      if (isDefault) {
        db.addresses.forEach((address) => {
          if (address.customerId === input.customerId) address.isDefault = false;
        });
      }
      const now = this.now();
      const created = {
        ...input,
        isDefault,
        id: this.id("address"),
        createdAt: now,
        updatedAt: now,
      };
      db.addresses.push(created);
      return created;
    });
    this.emit("address.changed", { entityId: item.id, action: "created" });
    return item;
  }

  async update(id: string, input: UpdateAddressInput) {
    const item = this.store.mutate((db) => {
      const current = db.addresses.find((address) => address.id === id);
      if (!current) throw this.missing("Address", id);
      const next = { ...current, ...input };
      this.assertValidAddress(next);
      if (input.isDefault) {
        db.addresses.forEach((address) => {
          if (address.customerId === current.customerId) address.isDefault = address.id === id;
        });
      }
      return this.updateById(db.addresses, id, input, "Address");
    });
    this.emit("address.changed", { entityId: item.id, action: "updated" });
    return item;
  }

  async remove(id: string) {
    const removed = this.store.mutate((db) => {
      const existing = db.addresses.find((address) => address.id === id);
      if (!existing) throw this.missing("Address", id);
      db.addresses = db.addresses.filter((address) => address.id !== id);
      return existing;
    });
    this.emit("address.changed", { entityId: removed.id, action: "deleted" });
  }

  async setDefault(customerId: string, addressId: string) {
    const item = this.store.mutate((db) => {
      const selected = db.addresses.find(
        (address) => address.id === addressId && address.customerId === customerId,
      );
      if (!selected) throw this.missing("Address", addressId);
      db.addresses.forEach((address) => {
        if (address.customerId === customerId) {
          address.isDefault = address.id === addressId;
          address.updatedAt = this.now();
        }
      });
      return selected;
    });
    this.emit("address.changed", { entityId: item.id, action: "updated" });
    return item;
  }

  private assertValidAddress(input: {
    label: string;
    recipientName: string;
    line1: string;
    city: string;
    country: string;
  }): void {
    const required: Array<[string, string]> = [
      ["label", input.label],
      ["recipientName", input.recipientName],
      ["line1", input.line1],
      ["city", input.city],
      ["country", input.country],
    ];
    for (const [field, value] of required) {
      if (!value || !value.trim()) {
        throw new Error(`Address ${field} is required`);
      }
    }
  }

  private assertCustomerExists(customerId: string, db: MockDatabase): void {
    const customer = db.customers.find((item) => item.id === customerId);
    if (!customer) throw this.missing("Customer", customerId);
  }
}
