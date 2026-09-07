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
}
