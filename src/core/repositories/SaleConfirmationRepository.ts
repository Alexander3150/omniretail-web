import type {
  CashMovement,
  InventoryMovement,
  Payment,
  Sale,
  SaleDocumentSnapshot,
} from "@/core/entities";
import type { PaymentMethod, PaymentStatus } from "@/core/enums";
import type { CreateSaleItemInput } from "@/core/repositories/SalesRepository";
import type { CurrencyCode } from "@/core/types/common.types";

export type SaleConfirmationPaymentMethod = Exclude<PaymentMethod, "mixed">;

export interface SaleConfirmationPaymentInput {
  method: SaleConfirmationPaymentMethod;
  amount: number;
  currency: CurrencyCode;
  status?: PaymentStatus;
  bankAccountId?: string;
  reference?: string;
  manualVerification?: {
    externallyVerified: boolean;
    verifiedByUserId: string;
  };
}

export interface ConfirmSaleInput {
  confirmationId: string;
  tenantId: string;
  branchId: string;
  cashierUserId: string;
  cashShiftId: string;
  customerId?: string;
  sourceOrderId?: string;
  items: CreateSaleItemInput[];
  document?: SaleDocumentSnapshot;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  payments: SaleConfirmationPaymentInput[];
}

export interface ConfirmSaleResult {
  sale: Sale;
  payments: Payment[];
  inventoryMovements: InventoryMovement[];
  cashMovement?: CashMovement;
  idempotent: boolean;
}

export interface SaleConfirmationRepository {
  confirm(input: ConfirmSaleInput): Promise<ConfirmSaleResult>;
}
