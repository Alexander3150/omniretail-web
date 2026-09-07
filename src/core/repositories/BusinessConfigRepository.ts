import type { BusinessCapabilitiesConfig, EcommerceConfig } from "@/core/entities";
export interface BusinessConfigRepository {
  getCapabilities(tenantId: string): Promise<BusinessCapabilitiesConfig | null>;
  updateCapabilities(
    tenantId: string,
    input: Partial<BusinessCapabilitiesConfig>,
  ): Promise<BusinessCapabilitiesConfig>;
  getEcommerceConfig(tenantId: string): Promise<EcommerceConfig | null>;
  updateEcommerceConfig(
    tenantId: string,
    input: Partial<EcommerceConfig>,
  ): Promise<EcommerceConfig>;
}
