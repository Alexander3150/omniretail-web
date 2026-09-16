import type { BusinessCapabilitiesConfig, EcommerceConfig } from "@/core/entities";

export type UpdateEcommerceConfigInput = Pick<
  EcommerceConfig,
  | "enabled"
  | "storeName"
  | "contactPhone"
  | "contactEmail"
  | "requireAccountForCheckout"
  | "guestTrackingEnabled"
  | "allowedDeliveryMethods"
  | "allowedPaymentMethods"
  | "defaultBranchId"
>;

export interface BusinessConfigRepository {
  getCapabilities(tenantId: string): Promise<BusinessCapabilitiesConfig | null>;
  /**
   * Alta directa fuera del onboarding atómico -- foundation contract requerido por la auditoría
   * (feature/tenant-onboarding): `updateCapabilities` siempre asumió una fila existente (lanza si
   * `tenantId` no tiene una todavía), así que no servía para inicializar la config de un Tenant
   * recién creado. El onboarding real (`TenantOnboardingRepository`) NO usa este método por la
   * misma razón que `TenantRepository.create` -- necesita la fila dentro de la misma transacción
   * atómica que Tenant/Branch/Role/User/Auth/Subscription.
   */
  createCapabilities(input: BusinessCapabilitiesConfig): Promise<BusinessCapabilitiesConfig>;
  updateCapabilities(
    tenantId: string,
    input: Partial<BusinessCapabilitiesConfig>,
  ): Promise<BusinessCapabilitiesConfig>;
  getEcommerceConfig(tenantId: string): Promise<EcommerceConfig | null>;
  /** Mismo motivo/alcance que `createCapabilities` -- ver esa docstring. */
  createEcommerceConfig(
    input: Omit<EcommerceConfig, "createdAt" | "updatedAt">,
  ): Promise<EcommerceConfig>;
  updateEcommerceConfig(
    tenantId: string,
    input: UpdateEcommerceConfigInput,
  ): Promise<EcommerceConfig>;
}
