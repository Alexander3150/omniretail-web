import { UnitStatus } from "@/core/enums";
import type { UnitRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockUnitRepository extends BaseMockRepository implements UnitRepository {
  async getAll() {
    return this.read((db) => db.units);
  }
  async getById(id: string) {
    return this.read((db) => db.units.find((item) => item.id === id) ?? null);
  }
  async getActive() {
    return this.read((db) => db.units.filter((item) => item.status === "active"));
  }
  async getConversionsByProduct(productId: string) {
    return this.read((db) =>
      db.unitConversions
        .filter((item) => item.productId === productId)
        .sort((a, b) => a.fromUnitId.localeCompare(b.fromUnitId)),
    );
  }
  async getConversion(input: Parameters<UnitRepository["getConversion"]>[0]) {
    return this.read(
      (db) =>
        db.unitConversions.find(
          (item) =>
            item.tenantId === input.tenantId &&
            item.productId === input.productId &&
            item.fromUnitId === input.fromUnitId &&
            item.toUnitId === input.toUnitId,
        ) ?? null,
    );
  }
  async create(input: Parameters<UnitRepository["create"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = { ...input, id: this.id("units"), createdAt: now, updatedAt: now };
      db.units.push(created);
      return created;
    });
    this.emit("business-config.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "created",
    });
    return item;
  }
  async update(id: string, input: Parameters<UnitRepository["update"]>[1]) {
    const item = this.store.mutate((db) => this.updateById(db.units, id, input, "Unit"));
    this.emit("business-config.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "updated",
    });
    return item;
  }
  async upsertConversion(input: Parameters<UnitRepository["upsertConversion"]>[0]) {
    this.assertValidConversion(input.factor);
    const item = this.store.mutate((db) => {
      if (input.productId) {
        const product = db.products.find((item) => item.id === input.productId);
        if (!product) throw this.missing("Product", input.productId);
        if (product.tenantId !== input.tenantId) {
          throw new Error("Unit conversion tenant must match product tenant");
        }
      }
      const existingIndex = db.unitConversions.findIndex(
        (conversion) =>
          conversion.tenantId === input.tenantId &&
          conversion.productId === input.productId &&
          conversion.fromUnitId === input.fromUnitId &&
          conversion.toUnitId === input.toUnitId,
      );
      if (existingIndex >= 0) {
        const updated = {
          ...db.unitConversions[existingIndex],
          ...input,
        };
        db.unitConversions[existingIndex] = updated;
        return updated;
      }
      const created = { ...input, id: this.id("unit-conversion"), createdAt: this.now() };
      db.unitConversions.push(created);
      return created;
    });
    this.emit("unit-conversion.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      productId: item.productId,
      action: "updated",
    });
    return item;
  }
  async replaceConversionsForProduct(
    productId: string,
    conversions: Parameters<UnitRepository["replaceConversionsForProduct"]>[1],
  ) {
    conversions.forEach((conversion) => this.assertValidConversion(conversion.factor));
    const items = this.store.mutate((db) => {
      const product = db.products.find((item) => item.id === productId);
      if (!product) throw this.missing("Product", productId);
      conversions.forEach((conversion) => {
        if (conversion.tenantId !== product.tenantId) {
          throw new Error("Unit conversion tenant must match product tenant");
        }
      });
      db.unitConversions = db.unitConversions.filter((item) => item.productId !== productId);
      const created = conversions.map((conversion) => ({
        ...conversion,
        productId,
        id: this.id("unit-conversion"),
        createdAt: this.now(),
      }));
      db.unitConversions.push(...created);
      return created;
    });
    this.emit("unit-conversion.changed", { productId, action: "updated" });
    return items;
  }
  async updateStatus(id: string, status: UnitStatus) {
    const item = this.store.mutate((db) =>
      this.updateById(db.units, id, { status: status }, "Unit"),
    );
    this.emit("business-config.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "status_changed",
    });
    return item;
  }
  async archive(id: string) {
    const item = this.store.mutate((db) =>
      this.updateById(db.units, id, { status: UnitStatus.archived }, "Unit"),
    );
    this.emit("business-config.changed", {
      entityId: item.id,
      tenantId: "tenantId" in item ? item.tenantId : undefined,
      action: "archived",
    });
    return item;
  }

  private assertValidConversion(factor: number): void {
    if (factor <= 0) {
      throw new Error("Unit conversion factor must be greater than 0");
    }
  }
}
