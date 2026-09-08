import type { CustomerPaymentMethodStatus, PaymentMethod } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface CustomerPaymentMethod {
  id: string;
  tenantId: string;
  customerId: string;
  type: PaymentMethod.card;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName?: string;
  isDefault: boolean;
  status: CustomerPaymentMethodStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
