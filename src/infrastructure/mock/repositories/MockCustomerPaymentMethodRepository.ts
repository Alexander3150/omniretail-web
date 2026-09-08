import type {
  CreateCustomerPaymentMethodInput,
  CustomerPaymentMethodRepository,
  UpdateCustomerPaymentMethodInput,
} from "@/core/repositories";
import { CustomerPaymentMethodStatus, PaymentMethod } from "@/core/enums";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

const sensitiveFields = new Set(["cardNumber", "cvv", "cvc", "pin"]);

export class MockCustomerPaymentMethodRepository
  extends BaseMockRepository
  implements CustomerPaymentMethodRepository
{
  async getByCustomer(customerId: string) {
    return this.read((db) =>
      db.customerPaymentMethods.filter(
        (item) =>
          item.customerId === customerId && item.status === CustomerPaymentMethodStatus.active,
      ),
    );
  }

  async getById(id: string) {
    return this.read((db) => db.customerPaymentMethods.find((item) => item.id === id) ?? null);
  }

  async create(input: CreateCustomerPaymentMethodInput) {
    this.assertNoSensitiveFields(input);
    this.assertValidPaymentMethod(input);
    const item = this.store.mutate((db) => {
      this.assertCustomerTenant(input.customerId, input.tenantId, db);
      const status = input.status ?? CustomerPaymentMethodStatus.active;
      if (input.isDefault && status === CustomerPaymentMethodStatus.active) {
        db.customerPaymentMethods.forEach((method) => {
          if (method.customerId === input.customerId) method.isDefault = false;
        });
      }
      const now = this.now();
      const created = {
        ...input,
        isDefault: status === CustomerPaymentMethodStatus.archived ? false : input.isDefault,
        status,
        id: this.id("customer-payment-method"),
        createdAt: now,
        updatedAt: now,
      };
      db.customerPaymentMethods.push(created);
      return created;
    });
    this.emit("customer-payment-method.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "created",
    });
    return item;
  }

  async update(id: string, input: UpdateCustomerPaymentMethodInput) {
    this.assertNoSensitiveFields(input);
    const item = this.store.mutate((db) => {
      const current = db.customerPaymentMethods.find((method) => method.id === id);
      if (!current) throw this.missing("CustomerPaymentMethod", id);
      const next = { ...current, ...input };
      this.assertValidPaymentMethod(next);
      const normalizedInput = {
        ...input,
        isDefault: next.status === CustomerPaymentMethodStatus.archived ? false : input.isDefault,
      };
      if (next.isDefault) {
        db.customerPaymentMethods.forEach((method) => {
          if (method.customerId === next.customerId) method.isDefault = method.id === id;
        });
      }
      return this.updateById(
        db.customerPaymentMethods,
        id,
        normalizedInput,
        "CustomerPaymentMethod",
      );
    });
    this.emit("customer-payment-method.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "updated",
    });
    return item;
  }

  async remove(id: string) {
    const removed = this.store.mutate((db) => {
      const existing = db.customerPaymentMethods.find((method) => method.id === id);
      if (!existing) throw this.missing("CustomerPaymentMethod", id);
      db.customerPaymentMethods = db.customerPaymentMethods.filter((method) => method.id !== id);
      return existing;
    });
    this.emit("customer-payment-method.changed", {
      entityId: removed.id,
      tenantId: removed.tenantId,
      action: "deleted",
    });
  }

  async setDefault(customerId: string, paymentMethodId: string) {
    const item = this.store.mutate((db) => {
      const selected = db.customerPaymentMethods.find(
        (method) =>
          method.id === paymentMethodId &&
          method.customerId === customerId &&
          method.status === CustomerPaymentMethodStatus.active,
      );
      if (!selected) throw this.missing("CustomerPaymentMethod", paymentMethodId);
      db.customerPaymentMethods.forEach((method) => {
        if (method.customerId === customerId) {
          method.isDefault = method.id === paymentMethodId;
          method.updatedAt = this.now();
        }
      });
      return selected;
    });
    this.emit("customer-payment-method.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "updated",
    });
    return item;
  }

  private assertNoSensitiveFields(input: Record<string, unknown>): void {
    for (const key of Object.keys(input)) {
      if (sensitiveFields.has(key)) {
        throw new Error(`Sensitive payment field is not allowed: ${key}`);
      }
    }
  }

  private assertValidPaymentMethod(input: CreateCustomerPaymentMethodInput): void {
    if (input.type !== PaymentMethod.card) {
      throw new Error("CustomerPaymentMethod type must be card for V1");
    }
    if (!/^\d{4}$/.test(input.last4)) {
      throw new Error("CustomerPaymentMethod last4 must contain exactly 4 digits");
    }
    if (input.expirationMonth < 1 || input.expirationMonth > 12) {
      throw new Error("CustomerPaymentMethod expirationMonth must be between 1 and 12");
    }
    if (input.expirationYear < new Date().getFullYear()) {
      throw new Error("CustomerPaymentMethod expirationYear must be current year or later");
    }
  }

  private assertCustomerTenant(customerId: string, tenantId: string, db: MockDatabase): void {
    const customer = db.customers.find((item) => item.id === customerId);
    if (!customer) throw this.missing("Customer", customerId);
    if (customer.tenantId !== tenantId) {
      throw new Error("CustomerPaymentMethod tenant must match customer tenant");
    }
  }
}
