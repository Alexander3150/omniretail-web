import { InventoryMovementType, LocationStatus } from "@/core/enums";
import type {
  InventoryBalance,
  InventoryMovement,
  ProductInventorySettings,
  StorageLocation,
} from "@/core/entities";
import type { InventoryRepository, RegisterInventoryMovementInput } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockInventoryRepository extends BaseMockRepository implements InventoryRepository {
  async getBalances() {
    return this.read((db) => db.inventoryBalances);
  }
  async getBalanceByProduct(productId: string, branchId?: string) {
    return this.read((db) =>
      db.inventoryBalances.filter(
        (item) => item.productId === productId && (!branchId || item.branchId === branchId),
      ),
    );
  }
  async getMovements(productId?: string) {
    return this.read((db) =>
      db.inventoryMovements.filter((item) => !productId || item.productId === productId),
    );
  }
  async getLots(productId?: string) {
    return this.read((db) =>
      db.stockLots.filter((item) => !productId || item.productId === productId),
    );
  }
  async getSerialNumbers(productId?: string) {
    return this.read((db) =>
      db.serialNumbers.filter((item) => !productId || item.productId === productId),
    );
  }
  async getLocations(branchId?: string) {
    return this.read((db) =>
      db.storageLocations.filter((item) => !branchId || item.branchId === branchId),
    );
  }
  async createLocation(input: Omit<StorageLocation, "id" | "createdAt" | "updatedAt">) {
    const location = this.store.mutate((db) => {
      const now = this.now();
      const created = {
        ...input,
        id: this.id("location"),
        createdAt: now,
        updatedAt: now,
      };
      db.storageLocations.push(created);
      return created;
    });
    this.emit("inventory.changed", {
      entityId: location.id,
      tenantId: location.tenantId,
      branchId: location.branchId,
      action: "created",
    });
    return location;
  }
  async updateLocation(
    id: string,
    input: Partial<Omit<StorageLocation, "id" | "createdAt" | "updatedAt">>,
  ) {
    const location = this.store.mutate((db) =>
      this.updateById(db.storageLocations, id, input, "StorageLocation"),
    );
    this.emit("inventory.changed", {
      entityId: location.id,
      tenantId: location.tenantId,
      branchId: location.branchId,
      action: input.status === "archived" ? "archived" : "updated",
    });
    return location;
  }
  async getProductInventorySettings(productId: string, branchId: string) {
    return this.read(
      (db) =>
        db.productInventorySettings.find(
          (item) => item.productId === productId && item.branchId === branchId,
        ) ?? null,
    );
  }
  async upsertProductInventorySettings(
    input: Parameters<InventoryRepository["upsertProductInventorySettings"]>[0],
  ) {
    const result = this.store.mutate((db) => {
      this.assertValidProductInventorySettings(input);
      const product = db.products.find((item) => item.id === input.productId);
      if (!product) throw this.missing("Product", input.productId);
      if (product.tenantId !== input.tenantId) {
        throw new Error("Product inventory settings tenant must match product tenant");
      }
      const branch = db.branches.find((item) => item.id === input.branchId);
      if (!branch) throw this.missing("Branch", input.branchId);
      if (branch.tenantId !== input.tenantId) {
        throw new Error("Product inventory settings tenant must match branch tenant");
      }
      if (input.defaultLocationId) {
        const location = db.storageLocations.find((item) => item.id === input.defaultLocationId);
        if (!location) throw this.missing("StorageLocation", input.defaultLocationId);
        if (location.tenantId !== input.tenantId) {
          throw new Error("Default location tenant must match product inventory settings tenant");
        }
        if (location.branchId !== input.branchId) {
          throw new Error("Default location branch must match product inventory settings branch");
        }
        if (location.status !== LocationStatus.active) {
          throw new Error("Default location must be active");
        }
      }

      const now = this.now();
      const existingIndex = db.productInventorySettings.findIndex(
        (item) =>
          item.tenantId === input.tenantId &&
          item.productId === input.productId &&
          item.branchId === input.branchId,
      );

      if (existingIndex >= 0) {
        const current = db.productInventorySettings[existingIndex];
        const updated: ProductInventorySettings = {
          ...current,
          ...input,
          defaultLocationId: input.defaultLocationId ?? undefined,
          reorderPoint: input.reorderPoint,
          updatedAt: now,
        };
        db.productInventorySettings[existingIndex] = updated;
        return { settings: updated, action: "updated" as const };
      }

      const created: ProductInventorySettings = {
        ...input,
        id: this.id("product-inventory-settings"),
        defaultLocationId: input.defaultLocationId ?? undefined,
        createdAt: now,
        updatedAt: now,
      };
      db.productInventorySettings.push(created);
      return { settings: created, action: "created" as const };
    });
    this.emit("inventory.changed", {
      entityId: result.settings.id,
      tenantId: result.settings.tenantId,
      branchId: result.settings.branchId,
      productId: result.settings.productId,
      action: result.action,
      metadata: { entity: "ProductInventorySettings" },
    });
    return result.settings;
  }
  async registerMovement(input: RegisterInventoryMovementInput) {
    const movement = this.store.mutate((db) => {
      const created: InventoryMovement = {
        ...input,
        id: this.id("movement"),
        createdAt: this.now(),
      };
      db.inventoryMovements.push(created);
      this.applyMovementToBalances(db.inventoryBalances, created);
      return created;
    });
    this.emit("inventory.changed", {
      entityId: movement.id,
      tenantId: movement.tenantId,
      branchId: movement.branchId,
      productId: movement.productId,
      action: "created",
    });
    this.emit("stock.changed", {
      tenantId: movement.tenantId,
      branchId: movement.branchId,
      productId: movement.productId,
      action: "updated",
    });
    return movement;
  }
  async adjustStock(input: Omit<RegisterInventoryMovementInput, "type">) {
    return this.registerMovement({ ...input, type: InventoryMovementType.adjustment });
  }
  async transferStock(
    input: Omit<RegisterInventoryMovementInput, "type" | "quantity"> & {
      quantity: number;
      fromLocationId: string;
      toLocationId: string;
    },
  ) {
    return this.registerMovement({ ...input, type: InventoryMovementType.transfer });
  }
  private applyMovementToBalances(balances: InventoryBalance[], movement: InventoryMovement): void {
    const now = this.now();
    const findOrCreate = (locationId?: string) => {
      let balance = balances.find(
        (item) =>
          item.tenantId === movement.tenantId &&
          item.branchId === movement.branchId &&
          item.productId === movement.productId &&
          item.locationId === locationId,
      );
      if (!balance) {
        balance = {
          id: this.id("balance"),
          tenantId: movement.tenantId,
          branchId: movement.branchId,
          productId: movement.productId,
          locationId,
          quantity: 0,
          reservedQuantity: 0,
          updatedAt: now,
        };
        balances.push(balance);
      }
      return balance;
    };
    if (movement.type === InventoryMovementType.transfer) {
      findOrCreate(movement.fromLocationId).quantity -= movement.quantity;
      findOrCreate(movement.toLocationId).quantity += movement.quantity;
    } else {
      const balance = findOrCreate(movement.toLocationId ?? movement.fromLocationId);
      const direction = movement.type === InventoryMovementType.out ? -1 : 1;
      balance.quantity += movement.quantity * direction;
    }
    balances
      .filter(
        (item) => item.productId === movement.productId && item.branchId === movement.branchId,
      )
      .forEach((item) => {
        item.updatedAt = now;
      });
  }

  private assertValidProductInventorySettings(
    input: Parameters<InventoryRepository["upsertProductInventorySettings"]>[0],
  ): void {
    if (input.minStock < 0) {
      throw new Error("Product inventory settings minStock must be greater than or equal to 0");
    }
    if (typeof input.reorderPoint === "number" && input.reorderPoint < 0) {
      throw new Error("Product inventory settings reorderPoint must be greater than or equal to 0");
    }
  }
}
