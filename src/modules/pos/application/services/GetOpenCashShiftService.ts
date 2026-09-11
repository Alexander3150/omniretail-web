import type { CashShift } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  assertOwnedCashShift,
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type OpenCashShiftQueryRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashShifts" | "roles" | "users"
>;

export class GetOpenCashShiftService {
  constructor(private readonly repositories: OpenCashShiftQueryRepositories) {}

  async execute(input: CashShiftOperationContext): Promise<CashShift | null> {
    const { branch, user } = await requireCashContext(this.repositories, input, "pos.cash.read");
    const shift = await this.repositories.cashShifts.getOpenByUserAndBranch(
      input.tenantId,
      user.id,
      branch.id,
    );
    if (shift) assertOwnedCashShift(shift, input);
    return shift;
  }
}
