import type { BankAccountType, SaleDocumentType } from "@/core/entities";
import type { DeliveryMethod, TransportMode } from "@/core/enums";
import type { CurrencyCode } from "@/core/types/common.types";
import type { AddressSnapshot } from "@/core/types/address.types";
import type { OrderNotificationContact } from "@/core/types/orderNotification.types";
import type { StorePickupContactSnapshot } from "@/core/types/storePickupContact.types";

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
  storePickupContact?: StorePickupContactSnapshot;
  notificationContact: OrderNotificationContact;
}

/**
 * Datos estructurados de una cuenta bancaria disponible para el checkout de POS. A propósito NO
 * es un `label` único concatenado -- cada campo llega por separado para que la UI decida cómo
 * mostrarlos (y para que `accountNumber` completo, el único consumidor autorizado a recibirlo,
 * no termine escondido dentro de un string que también viaja a otros lugares).
 */
export interface CheckoutBankAccountDto {
  id: string;
  bankName: string;
  accountType: BankAccountType;
  holderName: string;
  accountNumber: string;
  currency: CurrencyCode;
}
