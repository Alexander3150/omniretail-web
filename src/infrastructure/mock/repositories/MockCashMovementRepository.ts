import { normalizeMoney } from "@/core/cash/cashShiftTotals";
import { CashMovementType, CashShiftStatus, UserStatus, UserType } from "@/core/enums";
import type { CashMovementRepository } from "@/core/repositories";
import { BaseMockRepository } from "@/infrastructure/mock/repositories/base";

export class MockCashMovementRepository
  extends BaseMockRepository
  implements CashMovementRepository
{
  async listByCashShift(tenantId: string, cashShiftId: string) {
    return this.read((db) => {
      const shift = db.cashShifts.find(
        (item) => item.id === cashShiftId && item.tenantId === tenantId,
      );
      if (!shift) throw this.missing("CashShift", cashShiftId);

      return db.cashMovements
        .filter((movement) => movement.cashShiftId === shift.id)
        .sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
        );
    });
  }

  async register(input: Parameters<CashMovementRepository["register"]>[0]) {
    const item = this.store.transact((db) => {
      const shift = db.cashShifts.find(
        (candidate) => candidate.id === input.cashShiftId && candidate.tenantId === input.tenantId,
      );
      if (!shift) throw this.missing("CashShift", input.cashShiftId);
      if (shift.status !== CashShiftStatus.open) {
        throw new Error("Cash movements require an open cash shift.");
      }
      const branch = db.branches.find(
        (candidate) => candidate.id === shift.branchId && candidate.tenantId === input.tenantId,
      );
      if (!branch) throw new Error("CashShift branch is not valid for tenant.");
      const actor = db.users.find(
        (candidate) =>
          candidate.id === input.createdByUserId && candidate.tenantId === input.tenantId,
      );
      if (
        !actor ||
        actor.type !== UserType.employee ||
        actor.status !== UserStatus.active ||
        actor.id !== shift.userId
      ) {
        throw new Error("Cash movement actor is not the active user assigned to the shift.");
      }
      if (input.type !== CashMovementType.in && input.type !== CashMovementType.out) {
        throw new Error("Cash movement type is invalid.");
      }
      const reason = input.reason.trim();
      if (!reason) throw new Error("Cash movement reason is required.");
      const amount = normalizeMoney(input.amount);
      if (amount === 0) throw new Error("Cash movement amount must be greater than zero.");

      const created = {
        id: this.id("cash-movement"),
        cashShiftId: shift.id,
        type: input.type,
        amount,
        reason,
        createdByUserId: actor.id,
        createdAt: this.now(),
      };
      db.cashMovements.push(created);
      return { movement: created, shift };
    });
    this.emit("cash-shift.changed", {
      entityId: item.shift.id,
      tenantId: item.shift.tenantId,
      branchId: item.shift.branchId,
      action: "updated",
    });
    return item.movement;
  }
}
