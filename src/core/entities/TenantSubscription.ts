import type { TenantSubscriptionStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

/**
 * Tenant-scoped -- vincula un Tenant a un PlanDefinition. `addonCodes` queda tipado pero SIN
 * motor de add-ons todavía (§6 del ticket foundation): hoy es siempre un array vacío o
 * undefined, reservado para que ResolveTenantEntitlementsService pueda aplicar overrides en una
 * fase futura sin volver a tocar este contrato. `status` es la foundation mínima -- ver
 * SaasSubscriptionStatus: `suspended`/`cancelled` solo se INFORMAN acá, el enforcement (bloquear
 * navegación/login) es un PR posterior.
 */
export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: TenantSubscriptionStatus;
  startedAt: ISODateString;
  addonCodes?: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
