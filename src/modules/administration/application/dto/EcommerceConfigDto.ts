import type { EcommerceConfig } from "@/core/entities";

export type EcommerceConfigDto = Omit<EcommerceConfig, "tenantId">;

export type EcommerceConfigInputDto = Pick<
  EcommerceConfig,
  | "enabled"
  | "storeName"
  | "requireAccountForCheckout"
  | "guestTrackingEnabled"
  | "allowedDeliveryMethods"
  | "allowedPaymentMethods"
  | "defaultBranchId"
>;
