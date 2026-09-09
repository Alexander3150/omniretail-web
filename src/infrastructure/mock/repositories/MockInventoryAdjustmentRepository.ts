import { InventoryAdjustmentType } from "@/core/enums";
import type { InventoryAdjustment } from "@/core/entities";
import type {
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentRepository,
} from "@/core/repositories";
import type { MockDatabase } from "@/infrastructure/mock/database/MockDatabase";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockInventoryAdjustmentRepository
  extends BaseMockRepository
  implements InventoryAdjustmentRepository
{
  async getById(id: string) {
    return this.read((db) => db.inventoryAdjustments.find((item) => item.id === id) ?? null);
  }

  async getByNumber(tenantId: string, number: string) {
    return this.read(
      (db) =>
        db.inventoryAdjustments.find(
          (item) => item.tenantId === tenantId && item.number === number,
        ) ?? null,
    );
  }

  async query(filters: Parameters<InventoryAdjustmentRepository["query"]>[0] = {}) {
    return this.read((db) =>
      db.inventoryAdjustments
        .filter(
          (item) =>
            (!filters.tenantId || item.tenantId === filters.tenantId) &&
            (!filters.branchId || item.branchId === filters.branchId) &&
            (!filters.productId || item.productId === filters.productId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async create(input: CreateInventoryAdjustmentInput) {
    const adjustment = this.store.mutate((db) => {
      this.assertValidCreateInput(db, input);
      const now = this.now();
      const delta = input.quantityAfter - input.quantityBefore;
      const created: InventoryAdjustment = {
        id: this.id("inventory-adjustment"),
        tenantId: input.tenantId,
        number: this.generateAdjustmentNumber(db, input.tenantId, now),
        branchId: input.branchId,
        productId: input.productId,
        locationId: input.locationId,
        type: input.type,
        reason: input.reason.trim(),
        notes: input.notes?.trim() || undefined,
        quantityBefore: input.quantityBefore,
        quantityAfter: input.quantityAfter,
        delta,
        performedByUserId: input.performedByUserId,
        createdAt: now,
      };
      db.inventoryAdjustments.push(created);
      return created;
    });
    this.emitChanged(adjustment);
    return adjustment;
  }

  private assertValidCreateInput(db: MockDatabase, input: CreateInventoryAdjustmentInput): void {
    const tenant = db.tenants.find((item) => item.id === input.tenantId);
    if (!tenant) throw this.missing("Tenant", input.tenantId);

    const branch = db.branches.find((item) => item.id === input.branchId);
    if (!branch) throw this.missing("Branch", input.branchId);
    if (branch.tenantId !== input.tenantId) {
      throw new Error("Inventory adjustment branch must match adjustment tenant");
    }

    const product = db.products.find((item) => item.id === input.productId);
    if (!product) throw this.missing("Product", input.productId);
    if (product.tenantId !== input.tenantId) {
      throw new Error("Inventory adjustment product must match adjustment tenant");
    }

    if (input.locationId) {
      const location = db.storageLocations.find((item) => item.id === input.locationId);
      if (!location) throw this.missing("StorageLocation", input.locationId);
      if (location.tenantId !== input.tenantId || location.branchId !== input.branchId) {
        throw new Error("Inventory adjustment location must match adjustment tenant and branch");
      }
    }

    if (input.performedByUserId) {
      const user = db.users.find((item) => item.id === input.performedByUserId);
      if (!user) throw this.missing("User", input.performedByUserId);
      if (user.tenantId !== input.tenantId) {
        throw new Error("Inventory adjustment user must match adjustment tenant");
      }
    }

    this.assertQuantity(input.quantityBefore, "quantityBefore");
    this.assertQuantity(input.quantityAfter, "quantityAfter");
    this.assertDelta(input);

    if (!input.reason.trim()) {
      throw new Error("Inventory adjustment reason is required");
    }
  }

  private assertQuantity(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Inventory adjustment ${field} must be greater than or equal to 0`);
    }
  }

  private assertDelta(input: CreateInventoryAdjustmentInput): void {
    const delta = input.quantityAfter - input.quantityBefore;
    if (delta === 0) {
      throw new Error("Inventory adjustment delta must be different from 0");
    }
    if (input.type === InventoryAdjustmentType.manualIncrease && delta <= 0) {
      throw new Error("Inventory adjustment manualIncrease requires a positive delta");
    }
    if (
      (input.type === InventoryAdjustmentType.manualDecrease ||
        input.type === InventoryAdjustmentType.waste) &&
      delta >= 0
    ) {
      throw new Error("Inventory adjustment decrease types require a negative delta");
    }
  }

  private generateAdjustmentNumber(db: MockDatabase, tenantId: string, date: string): string {
    const year = new Date(date).getFullYear();
    const prefix = `AJ-${year}-`;
    const next =
      db.inventoryAdjustments
        .filter(
          (adjustment) => adjustment.tenantId === tenantId && adjustment.number.startsWith(prefix),
        )
        .map((adjustment) => Number(adjustment.number.slice(prefix.length)))
        .filter((value) => Number.isInteger(value))
        .reduce((max, value) => Math.max(max, value), 0) + 1;
    return `${prefix}${String(next).padStart(5, "0")}`;
  }

  private emitChanged(adjustment: InventoryAdjustment): void {
    this.emit("inventory-adjustment.changed", {
      entityId: adjustment.id,
      tenantId: adjustment.tenantId,
      branchId: adjustment.branchId,
      productId: adjustment.productId,
      action: "created",
      metadata: {
        number: adjustment.number,
        type: adjustment.type,
        delta: adjustment.delta,
        locationId: adjustment.locationId,
      },
    });
  }
}
