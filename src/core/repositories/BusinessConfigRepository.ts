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
  updateCapabilities(
    tenantId: string,
    input: Partial<BusinessCapabilitiesConfig>,
  ): Promise<BusinessCapabilitiesConfig>;
  getEcommerceConfig(tenantId: string): Promise<EcommerceConfig | null>;
  updateEcommerceConfig(
    tenantId: string,
    input: UpdateEcommerceConfigInput,
  ): Promise<EcommerceConfig>;
}
