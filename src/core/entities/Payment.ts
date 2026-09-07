import type { PaymentMethod, PaymentStatus } from "@/core/enums";
import type { CurrencyCode, ISODateString } from "@/core/types/common.types";

export interface Payment {
  id: string;
  tenantId: string;
  orderId?: string;
  saleId?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: CurrencyCode;
  bankAccountId?: string;
  reference?: string;
  createdAt: ISODateString;
}
