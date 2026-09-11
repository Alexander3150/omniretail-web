import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CashMovementDto } from "@/modules/pos/application/dto/CashMovementDto";
import { toCashMovementDto } from "@/modules/pos/application/mappers/CashMovementMapper";
import {
  assertOwnedCashShift,
  requireCashContext,
  type CashShiftOperationContext,
} from "@/modules/pos/application/services/cashShiftServiceContext";

type CashMovementQueryRepositories = Pick<
  RepositoryRegistry,
  "branches" | "cashMovements" | "cashShifts" | "roles" | "users"
>;

export interface GetCashShiftMovementsRequest extends CashShiftOperationContext {
  cashShiftId: string;
}

export class GetCashShiftMovementsService {
  constructor(private readonly repositories: CashMovementQueryRepositories) {}

  async execute(input: GetCashShiftMovementsRequest): Promise<CashMovementDto[]> {
    await requireCashContext(this.repositories, input, "pos.cash.read");
    const shift = await this.repositories.cashShifts.getById(input.tenantId, input.cashShiftId);
    assertOwnedCashShift(shift, input);
    const movements = await this.repositories.cashMovements.listByCashShift(
      input.tenantId,
      input.cashShiftId,
    );
    return movements.map(toCashMovementDto);
  }
}
