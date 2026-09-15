import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { TenantEntitlementsDto } from "@/modules/administration/application/dto/SubscriptionDto";
import {
  AdministrationServiceError,
  ensurePlanTenant,
} from "@/modules/administration/application/services/serviceHelpers";

/**
 * Domain service reutilizable -- pensado para que enforcement futuro (otro PR, después del
 * permission hardening) pueda preguntar `resolveEntitlements(tenantId)` sin volver a tocar este
 * contrato. Deliberadamente SIN chequeo de `permissions`: no es una pantalla, es la pieza que
 * cualquier consumidor (UI de administración, o más adelante un guard de
 * CreateEmployeeService/CreateBranchService/Storefront/etc.) usará para resolver "qué tiene
 * derecho a usar este Tenant" -- nunca "qué puede hacer este Employee" (Role.permissions) ni "en
 * qué sucursal puede operar este User" (User.allowedBranchIds), ver docstring de
 * TenantEntitlementsDto.
 *
 * Fail-closed y explícito (§7 del ticket foundation): sin TenantSubscription, o con una
 * Subscription que apunta a un PlanDefinition inexistente, esto LANZA -- nunca asume Enterprise
 * ni ningún otro plan por default para un tenant no reconocido. `subscriptionStatus`
 * `suspended`/`cancelled` NO lanza acá: esos estados se INFORMAN en la salida (foundation
 * mínima, §13) -- bloquear enforcement en base a ellos es un PR posterior.
 */
export class ResolveTenantEntitlementsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string): Promise<TenantEntitlementsDto> {
    ensurePlanTenant(tenantId);

    const subscription = await this.repositories.tenantSubscriptions.getByTenantId(tenantId);
    if (!subscription) {
      throw new AdministrationServiceError(
        "El negocio activo no tiene una suscripción configurada.",
      );
    }

    const plan = await this.repositories.plans.getById(subscription.planId);
    if (!plan) {
      throw new AdministrationServiceError(
        "El plan asociado a la suscripción del negocio ya no existe.",
      );
    }

    return {
      tenantId,
      planCode: plan.code,
      subscriptionStatus: subscription.status,
      capabilities: [...plan.capabilities],
      limits: { ...plan.limits },
    };
  }
}
