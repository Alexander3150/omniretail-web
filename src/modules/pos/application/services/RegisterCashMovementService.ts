import type { CashMovement } from "@/core/entities";
import type { CashMovementType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import {
  assertOwnedCashShift,
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type CashMovementRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashMovements" | "cashShifts" | "roles" | "users"
>;

export interface RegisterCashMovementRequest extends CashShiftOperationContext {
  cashShiftId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
}

export class RegisterCashMovementService {
  constructor(private readonly repositories: CashMovementRepositories) {}

  async execute(input: RegisterCashMovementRequest): Promise<CashMovement> {
    await requireCashContext(this.repositories, input, "pos.cash.movement.create");
    const shift = await this.repositories.cashShifts.getById(input.tenantId, input.cashShiftId);
    assertOwnedCashShift(shift, input);

    return this.repositories.cashMovements.register({
      tenantId: input.tenantId,
      cashShiftId: input.cashShiftId,
      type: input.type,
      amount: input.amount,
      reason: input.reason,
      createdByUserId: input.actorUserId,
    });
  }
}
