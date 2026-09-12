import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { CashShiftDto } from "@/modules/administration/application/dto/CashShiftDto";
import { toCashShiftDto } from "@/modules/administration/application/mappers/CashShiftMapper";
import {
  AdministrationServiceError,
  ensureCanReadCash,
  ensureCashActor,
  ensureCashTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetCashShiftsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    actorUserId: string,
    permissions: readonly string[],
  ): Promise<CashShiftDto[]> {
    ensureCanReadCash(permissions);
    ensureCashTenant(tenantId);
    ensureCashActor(actorUserId);

    const actor = await this.repositories.users.getById(actorUserId);
    if (!actor || actor.tenantId !== tenantId) {
      throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
    }
    const role = actor.roleId ? await this.repositories.roles.getById(actor.roleId) : null;
    if (!role || role.tenantId !== tenantId) {
      throw new AdministrationServiceError("No se pudo resolver el rol del usuario actual.");
    }

    const shifts = await this.repositories.cashShifts.listByTenant(tenantId);
    return shifts
      .filter((shift) => canUserAccessBranch(actor, role, shift.branchId))
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      .map(toCashShiftDto);
  }
}
