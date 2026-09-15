import type { PlanCode, SaasCapabilityKey, SaasLimitKey, TenantSubscriptionStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

/**
 * Salida READ-ONLY de ResolveTenantEntitlementsService -- lo que el Tenant tiene derecho
 * comercial a usar, nunca lo que un Employee puede hacer (Role.permissions) ni en qué sucursal
 * puede operar (User.allowedBranchIds). Pensado para que enforcement futuro (otro PR) pueda
 * preguntar `resolveEntitlements(tenantId)` sin volver a tocar este contrato.
 */
export interface TenantEntitlementsDto {
  tenantId: string;
  planCode: PlanCode;
  subscriptionStatus: TenantSubscriptionStatus;
  capabilities: SaasCapabilityKey[];
  /** Ausente = sin límite definido para ese key (nunca "ilimitado" ni "0" implícito). */
  limits: Partial<Record<SaasLimitKey, number>>;
}

export interface TenantUsageMetricDto {
  current: number;
  /** null = sin límite definido en el plan para este key -- nunca "ilimitado" fabricado. */
  limit: number | null;
}

/** Salida de GetTenantUsageService -- consumo real, tenant-scoped, nunca calculado en React. */
export interface TenantUsageDto {
  employees: TenantUsageMetricDto;
  branches: TenantUsageMetricDto;
}

export interface SubscriptionCapabilityDto {
  key: SaasCapabilityKey;
  included: boolean;
  /**
   * Solo presente cuando la capability tiene una configuración operacional independiente que
   * vale la pena mostrar (hoy: ecommerce vs EcommerceConfig.enabled). Es SOLO presentación --
   * nunca redefine si la capability está incluida en el plan.
   */
  operationalStatus?: string;
}

export interface SubscriptionUsageDto {
  key: SaasLimitKey;
  current: number;
  limit: number | null;
}

/**
 * Read model único para la pantalla "Planes y Suscripción" (GetTenantSubscriptionDetailsService)
 * -- la UI consume ESTE contrato, nunca recalcula entitlements/usage por su cuenta.
 */
export interface TenantSubscriptionDetailsDto {
  tenantId: string;
  subscription: {
    status: TenantSubscriptionStatus;
    startedAt: ISODateString;
  };
  plan: {
    code: PlanCode;
    name: string;
  };
  capabilities: SubscriptionCapabilityDto[];
  usage: SubscriptionUsageDto[];
}
