import { calculateCashShiftTotals } from "@/core/cash/cashShiftTotals";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CashShiftSummaryDto } from "@/modules/pos/application/dto/CashShiftSummaryDto";
import {
  assertOwnedCashShift,
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type CashShiftSummaryRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashMovements" | "cashShifts" | "roles" | "users"
>;

export interface GetCashShiftSummaryRequest extends CashShiftOperationContext {
  cashShiftId: string;
}

export class GetCashShiftSummaryService {
  constructor(private readonly repositories: CashShiftSummaryRepositories) {}

  async execute(input: GetCashShiftSummaryRequest): Promise<CashShiftSummaryDto> {
    await requireCashContext(this.repositories, input, "pos.cash.read");
    const shift = await this.repositories.cashShifts.getById(input.tenantId, input.cashShiftId);
    assertOwnedCashShift(shift, input);
    const movements = await this.repositories.cashMovements.listByCashShift(
      input.tenantId,
      input.cashShiftId,
    );
    const totals = calculateCashShiftTotals(shift.openingAmount, movements);

    return {
      cashShiftId: shift.id,
      status: shift.status,
      openedAt: shift.openedAt,
      ...totals,
    };
  }
}
