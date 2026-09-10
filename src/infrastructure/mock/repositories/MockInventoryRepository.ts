import { InventoryMovementType, InventoryReservationStatus, LocationStatus } from "@/core/enums";
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryReservation,
  InventoryReservationConsumeOperation,
  ProductInventorySettings,
  StorageLocation,
} from "@/core/entities";
import type {
  ConsumeInventoryReservationInput,
  ConsumeInventoryReservationResult,
  InventoryRepository,
  RegisterInventoryMovementInput,
  ReleaseInventoryReservationInput,
  ReserveOrderItemInput,
} from "@/core/repositories";
import type { DataEventName, DataEventPayload } from "@/core/types/events.types";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
import {
  findInventoryReservationBalance,
  findReservationForMutation,
  getInventoryReservationAllocationRemaining,
  releaseInventoryReservationInDatabase,
  reserveOrderItemInDatabase,
} from "@/infrastructure/mock/repositories/inventoryReservationMutations";

export class MockInventoryRepository extends BaseMockRepository implements InventoryRepository {
  async getBalances() {
    return this.read((db) => db.inventoryBalances);
  }
  async getReservationById(tenantId: string, reservationId: string) {
    return this.read(
      (db) =>
        db.inventoryReservations.find(
          (item) => item.tenantId === tenantId && item.id === reservationId,
        ) ?? null,
    );
  }
  async getReservationByOrderItem(tenantId: string, orderItemId: string) {
    return this.read(
      (db) =>
        db.inventoryReservations.find(
          (item) => item.tenantId === tenantId && item.orderItemId === orderItemId,
        ) ?? null,
    );
  }
  async reserveForOrderItem(input: ReserveOrderItemInput) {
    const result = this.store.transact((db) =>
      reserveOrderItemInDatabase(db, input, {
        id: (prefix) => this.id(prefix),
        now: () => this.now(),
      }),
    );

    if (result.changed) this.emitStockChanged(result.reservation);
    return result.reservation;
  }
  async releaseReservation(input: ReleaseInventoryReservationInput) {
    const result = this.store.transact((db) =>
      releaseInventoryReservationInDatabase(db, input, { now: () => this.now() }),
    );

    if (result.changed) this.emitStockChanged(result.reservation);
    return result.reservation;
  }
  async consumeReservation(
    input: ConsumeInventoryReservationInput,
  ): Promise<ConsumeInventoryReservationResult> {
    this.assertConsumeInput(input);
    const fingerprint = getConsumeFingerprint(input);

    const result = this.store.transact((db) => {
      const existingOperation = db.inventoryReservationConsumeOperations.find(
        (operation) =>
          operation.tenantId === input.tenantId && operation.operationId === input.operationId,
      );
      if (existingOperation) {
        if (existingOperation.fingerprint !== fingerprint) {
          throw new Error(`Inventory reservation operation conflict: ${input.operationId}`);
        }
        const inventoryMovements = existingOperation.inventoryMovementIds.map((movementId) => {
          const movement = db.inventoryMovements.find((item) => item.id === movementId);
          if (!movement) throw this.missing("InventoryMovement", movementId);
          return movement;
        });
        return {
          reservation: existingOperation.resultReservation,
          inventoryMovements,
          idempotent: true,
          changed: false,
        };
      }

      const reservation = findReservationForMutation(input, db);
      if (reservation.status === InventoryReservationStatus.released) {
        throw new Error(`Released reservation cannot be consumed: ${reservation.id}`);
      }
      if (reservation.status === InventoryReservationStatus.consumed) {
        throw new Error(`Consumed reservation has no remaining quantity: ${reservation.id}`);
      }

      const planned = input.allocationsConsumed.map((consumed) => {
        const allocation = reservation.allocations.find(
          (item) => item.balanceId === consumed.balanceId,
        );
        if (!allocation) {
          throw new Error(`Balance does not belong to reservation: ${consumed.balanceId}`);
        }
        const remaining = getInventoryReservationAllocationRemaining(allocation);
        if (consumed.quantity > remaining) {
          throw new Error(
            `Consumed quantity exceeds reservation allocation: ${consumed.balanceId}`,
          );
        }
        const balance = findInventoryReservationBalance(reservation, allocation, db);
        if (balance.quantity < consumed.quantity) {
          throw new Error(`Insufficient stock in balance: ${balance.id}`);
        }
        if (balance.reservedQuantity < consumed.quantity) {
          throw new Error(`Insufficient reserved stock in balance: ${balance.id}`);
        }
        return { allocation, balance, quantity: consumed.quantity };
      });

      const now = this.now();
      const inventoryMovements = planned.map(({ allocation, balance, quantity }) => {
        const quantityBefore = balance.quantity;
        balance.quantity -= quantity;
        balance.reservedQuantity -= quantity;
        balance.updatedAt = now;
        allocation.consumedQuantity += quantity;

        const movement: InventoryMovement = {
          id: this.id("movement"),
          tenantId: reservation.tenantId,
          branchId: reservation.branchId,
          productId: reservation.productId,
          type: InventoryMovementType.out,
          reason: `Consumo de reserva ${reservation.id}`,
          quantity,
          quantityBefore,
          quantityAfter: balance.quantity,
          fromLocationId: allocation.locationId,
          referenceType: "inventoryReservation",
          referenceId: reservation.id,
          performedByUserId: input.performedByUserId,
          createdAt: now,
        };
        db.inventoryMovements.push(movement);
        return movement;
      });

      reservation.status = reservation.allocations.some(
        (allocation) => getInventoryReservationAllocationRemaining(allocation) > 0,
      )
        ? InventoryReservationStatus.active
        : InventoryReservationStatus.consumed;
      reservation.updatedAt = now;

      const operation: InventoryReservationConsumeOperation = {
        id: this.id("reservation-consume-operation"),
        tenantId: input.tenantId,
        branchId: input.branchId,
        reservationId: input.reservationId,
        operationId: input.operationId,
        fingerprint,
        allocationsConsumed: input.allocationsConsumed.map((item) => ({ ...item })),
        inventoryMovementIds: inventoryMovements.map((movement) => movement.id),
        resultReservation: structuredClone(reservation),
        performedByUserId: input.performedByUserId,
        createdAt: now,
      };
      db.inventoryReservationConsumeOperations.push(operation);

      return { reservation, inventoryMovements, idempotent: false, changed: true };
    });

    if (result.changed) this.emitConsumedReservation(result);
    return {
      reservation: result.reservation,
      inventoryMovements: result.inventoryMovements,
      idempotent: result.idempotent,
    };
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
      const movement = this.applyMovementToBalances(db.inventoryBalances, created);
      db.inventoryMovements.push(movement);
      return movement;
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
  private assertConsumeInput(input: ConsumeInventoryReservationInput): void {
    assertRequiredText(input.tenantId, "Reservation tenantId");
    assertRequiredText(input.branchId, "Reservation branchId");
    assertRequiredText(input.reservationId, "Reservation id");
    assertRequiredText(input.operationId, "Reservation operationId");
    assertRequiredText(input.performedByUserId, "Reservation performedByUserId");
    if (input.allocationsConsumed.length === 0) {
      throw new Error("Reservation consumption requires at least one allocation");
    }
    const balanceIds = new Set<string>();
    input.allocationsConsumed.forEach((allocation) => {
      assertRequiredText(allocation.balanceId, "Consumed allocation balanceId");
      assertPositiveQuantity(allocation.quantity, "Consumed allocation quantity");
      if (balanceIds.has(allocation.balanceId)) {
        throw new Error(`Duplicate consumed balance: ${allocation.balanceId}`);
      }
      balanceIds.add(allocation.balanceId);
    });
  }

  private emitStockChanged(reservation: InventoryReservation): void {
    this.emitSafely("stock.changed", {
      entityId: reservation.id,
      tenantId: reservation.tenantId,
      branchId: reservation.branchId,
      productId: reservation.productId,
      action: "updated",
      metadata: { entity: "InventoryReservation", status: reservation.status },
    });
  }

  private emitConsumedReservation(
    result: Pick<ConsumeInventoryReservationResult, "reservation" | "inventoryMovements">,
  ): void {
    result.inventoryMovements.forEach((movement) => {
      this.emitSafely("inventory.changed", {
        entityId: movement.id,
        tenantId: movement.tenantId,
        branchId: movement.branchId,
        productId: movement.productId,
        action: "created",
      });
    });
    this.emitStockChanged(result.reservation);
  }

  private emitSafely(event: DataEventName, payload: DataEventPayload): void {
    try {
      this.emit(event, payload);
    } catch {
      // The transaction is already committed; listener failures cannot roll it back.
    }
  }

  private applyMovementToBalances(
    balances: InventoryBalance[],
    movement: InventoryMovement,
  ): InventoryMovement {
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
      const quantityBefore = balance.quantity;
      const direction = movement.type === InventoryMovementType.out ? -1 : 1;
      balance.quantity += movement.quantity * direction;
      movement.quantityBefore = movement.quantityBefore ?? quantityBefore;
      movement.quantityAfter = movement.quantityAfter ?? balance.quantity;
    }
    balances
      .filter(
        (item) => item.productId === movement.productId && item.branchId === movement.branchId,
      )
      .forEach((item) => {
        item.updatedAt = now;
      });
    return movement;
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

function assertPositiveQuantity(quantity: number, label: string): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
}

function assertRequiredText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function getConsumeFingerprint(input: ConsumeInventoryReservationInput): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    branchId: input.branchId,
    reservationId: input.reservationId,
    performedByUserId: input.performedByUserId,
    allocationsConsumed: input.allocationsConsumed
      .map((allocation) => ({
        balanceId: allocation.balanceId,
        quantity: allocation.quantity,
      }))
      .sort((left, right) => left.balanceId.localeCompare(right.balanceId)),
  });
}
