import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { EcommerceConfigDto } from "@/modules/administration/application/dto/EcommerceConfigDto";
import { toEcommerceConfigDto } from "@/modules/administration/application/mappers/EcommerceConfigMapper";
import {
  AdministrationServiceError,
  ensureCanManageEcommerceConfig,
  ensureEcommerceConfigActor,
  ensureEcommerceConfigTenant,
} from "@/modules/administration/application/services/serviceHelpers";

export class GetEcommerceConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    actorUserId: string,
    permissions: readonly string[],
  ): Promise<EcommerceConfigDto> {
    ensureCanManageEcommerceConfig(permissions);
    ensureEcommerceConfigTenant(tenantId);
    ensureEcommerceConfigActor(actorUserId);

    // `tenantId` llega del caller (React): no alcanza para leer la configuración de otro tenant
    // aunque coincida por accidente con el de la sesión real. Se resuelve el actor autenticado por
    // `actorUserId` y se exige que su `tenantId` coincida antes de tocar el repository -- mismo
    // mecanismo que ya usa `GetCashShiftsService` para branch scope.
    const actor = await this.repositories.users.getById(actorUserId);
    if (!actor || actor.tenantId !== tenantId) {
      throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
    }

    const config = await this.repositories.businessConfig.getEcommerceConfig(tenantId);

    if (!config) {
      throw new AdministrationServiceError(
        "No se encontró la configuración de e-commerce del negocio.",
      );
    }

    return toEcommerceConfigDto(config);
  }
}
