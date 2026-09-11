import type { CashShift } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type OpenCashShiftRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashShifts" | "roles" | "users"
>;

export interface OpenCashShiftRequest extends CashShiftOperationContext {
  registerCode: string;
  openingAmount: number;
}

export class OpenCashShiftService {
  constructor(private readonly repositories: OpenCashShiftRepositories) {}

  async execute(input: OpenCashShiftRequest): Promise<CashShift> {
    const { user, branch } = await requireCashContext(
      this.repositories,
      input,
      "pos.cash.open",
      true,
    );
    return this.repositories.cashShifts.open({
      tenantId: input.tenantId,
      branchId: branch.id,
      userId: user.id,
      registerCode: input.registerCode,
      openingAmount: input.openingAmount,
    });
  }
}
