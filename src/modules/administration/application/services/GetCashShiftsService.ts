import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CashShiftDto } from "@/modules/administration/application/dto/CashShiftDto";
import { toCashShiftDto } from "@/modules/administration/application/mappers/CashShiftMapper";
import {
  ensureCanReadCash,
  ensureCashTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetCashShiftsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, permissions: readonly string[]): Promise<CashShiftDto[]> {
    ensureCanReadCash(permissions);
    ensureCashTenant(tenantId);

    const shifts = await this.repositories.cashShifts.getAll();
    return shifts
      .filter((shift) => shift.tenantId === tenantId)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      .map(toCashShiftDto);
  }
}
