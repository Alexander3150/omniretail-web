import type { SaleDocumentType } from "@/core/entities";
import type { DeliveryMethod, TransportMode } from "@/core/enums";
import type { AddressSnapshot } from "@/core/types/address.types";

export type CheckoutPaymentMode = "cash" | "card" | "transfer" | "mixed";
export type CardTerminalStatus = "idle" | "processing" | "approved" | "rejected";
export type CardTerminalOutcome = Extract<CardTerminalStatus, "approved" | "rejected">;

export interface CardTerminalResultDto {
  status: CardTerminalStatus;
  reference?: string;
  authorizedAmount?: number;
}

export interface CheckoutInvoiceDataDto {
  taxId: string;
  legalName: string;
  fiscalAddress: string;
}

export interface CheckoutDto {
  documentType: SaleDocumentType;
  invoiceData: CheckoutInvoiceDataDto;
  paymentMode: CheckoutPaymentMode;
  cashAmount: number;
  cashReceived: number;
  changeAmount: number;
  cardAmount: number;
  cardTerminalResult: CardTerminalResultDto;
  transferAmount: number;
  bankAccountId: string;
  transferReference: string;
  transferExternallyVerified: boolean;
  deliveryMethod: DeliveryMethod;
  transportMode: TransportMode;
  deliveryAddress?: AddressSnapshot;
}

export interface CheckoutBankAccountDto {
  id: string;
  label: string;
}
