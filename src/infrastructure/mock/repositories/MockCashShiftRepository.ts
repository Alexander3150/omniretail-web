import { CashMovementType, CashShiftStatus } from "@/core/enums";
import type { CashShiftRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";
export class MockCashShiftRepository extends BaseMockRepository implements CashShiftRepository {
  async getAll() {
    return this.read((db) => db.cashShifts);
  }
  async getById(id: string) {
    return this.read((db) => db.cashShifts.find((item) => item.id === id) ?? null);
  }
  async getOpenByUser(userId: string) {
    return this.read(
      (db) =>
        db.cashShifts.find(
          (item) => item.userId === userId && item.status === CashShiftStatus.open,
        ) ?? null,
    );
  }
  async open(input: Parameters<CashShiftRepository["open"]>[0]) {
    const item = this.store.mutate((db) => {
      const now = this.now();
      const created = {
        ...input,
        id: this.id("cash-shift"),
        status: CashShiftStatus.open,
        openedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      db.cashShifts.push(created);
      return created;
    });
    this.emit("cash-shift.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "created",
    });
    return item;
  }
  async registerMovement(input: Parameters<CashShiftRepository["registerMovement"]>[0]) {
    const item = this.store.mutate((db) => {
      const created = { ...input, id: this.id("cash-movement"), createdAt: this.now() };
      db.cashMovements.push(created);
      return created;
    });
    this.emit("cash-shift.changed", { entityId: item.cashShiftId, action: "updated" });
    return item;
  }
  async close(id: string, countedAmount: number) {
    const item = this.store.mutate((db) => {
      const movements = db.cashMovements.filter((movement) => movement.cashShiftId === id);
      const shift = db.cashShifts.find((candidate) => candidate.id === id);
      if (!shift) throw this.missing("CashShift", id);
      const movementTotal = movements.reduce(
        (total, movement) =>
          total + (movement.type === CashMovementType.in ? movement.amount : -movement.amount),
        0,
      );
      const expectedAmount = shift.openingAmount + movementTotal;
      const difference = countedAmount - expectedAmount;
      Object.assign(shift, {
        countedAmount,
        expectedAmount,
        difference,
        closedAt: this.now(),
        updatedAt: this.now(),
        status: difference === 0 ? CashShiftStatus.closed : CashShiftStatus.closed_with_difference,
      });
      return shift;
    });
    this.emit("cash-shift.changed", {
      entityId: item.id,
      tenantId: item.tenantId,
      action: "status_changed",
    });
    return item;
  }
}
