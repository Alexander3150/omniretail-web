import type { PaymentMethod } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface SavedPaymentMethod {
  id: string;
  customerId: string;
  type: PaymentMethod;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
  isDefault: boolean;
  createdAt: ISODateString;
}
