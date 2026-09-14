import type { SaleDocumentType } from "@/core/entities";
import type { DeliveryMethod, OrderStatus, PaymentMethod, SaleStatus } from "@/core/enums";
import type { CurrencyCode } from "@/core/types/common.types";

export type PosSaleHistoryTone = "neutral" | "info" | "success" | "warning" | "danger";
export type PosSaleHistoryDeliveryFilter = "all" | "unavailable" | DeliveryMethod;
export type PosSaleHistoryOperationalFilter =
  "all" | "immediate" | "unavailable" | OrderStatus;

export interface PosSaleHistoryFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  deliveryMethod: PosSaleHistoryDeliveryFilter;
  saleStatus: "all" | SaleStatus;
  operationalStatus: PosSaleHistoryOperationalFilter;
}

export interface PosSaleHistoryItemDto {
  saleId: string;
  documentNumber: string;
  documentType: SaleDocumentType;
  taxId?: string;
  createdAt: string;
  customerDisplayName: string;
  total: number;
  saleStatus: SaleStatus;
  saleStatusLabel: string;
  saleStatusTone: PosSaleHistoryTone;
  deliveryMethod?: DeliveryMethod;
  deliveryMethodLabel: string;
  sourceOrderId?: string;
  orderNumber?: string;
  orderStatus?: OrderStatus;
  operationalStatusLabel: string;
  operationalStatusTone: PosSaleHistoryTone;
  hasUnavailableOrder: boolean;
  paymentSummary: string;
  payments: Array<{
    paymentId: string;
    method: PaymentMethod;
    methodLabel: string;
    amount: number;
    currency: CurrencyCode;
  }>;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
}

export interface PosSaleHistorySummaryDto {
  total: number;
  active: number;
  partiallyReturned: number;
  returned: number;
  cancelled: number;
}

export interface PosSaleHistoryDto {
  sales: PosSaleHistoryItemDto[];
  summary: PosSaleHistorySummaryDto;
}

export const defaultPosSaleHistoryFilters: PosSaleHistoryFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  deliveryMethod: "all",
  saleStatus: "all",
  operationalStatus: "all",
};
