import type { DeliveryMethod, PaymentMethod } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface EcommerceConfig {
  tenantId: string;
  enabled: boolean;
  storeName: string;
  requireAccountForCheckout: boolean;
  guestTrackingEnabled: boolean;
  allowedDeliveryMethods: DeliveryMethod[];
  allowedPaymentMethods: PaymentMethod[];
  defaultBranchId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
