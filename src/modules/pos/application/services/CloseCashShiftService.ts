import type { CashShift } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  assertOwnedCashShift,
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type CloseCashShiftRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashShifts" | "roles" | "users"
>;

export interface CloseCashShiftRequest extends CashShiftOperationContext {
  cashShiftId: string;
  countedAmount: number;
}

export class CloseCashShiftService {
  constructor(private readonly repositories: CloseCashShiftRepositories) {}

  async execute(input: CloseCashShiftRequest): Promise<CashShift> {
    await requireCashContext(this.repositories, input, "pos.cash.close");
    const shift = await this.repositories.cashShifts.getById(input.tenantId, input.cashShiftId);
    assertOwnedCashShift(shift, input);
    return this.repositories.cashShifts.close({
      tenantId: input.tenantId,
      cashShiftId: input.cashShiftId,
      countedAmount: input.countedAmount,
      closedByUserId: input.actorUserId,
    });
  }
}
