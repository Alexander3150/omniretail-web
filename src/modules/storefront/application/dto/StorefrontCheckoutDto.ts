import type { OrderStatus, PaymentStatus } from "@/core/enums";

export interface StorefrontCheckoutFormDto {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  department?: string;
  references?: string;
  cardholderName: string;
  cardLastFour: string;
}

export interface StorefrontCheckoutResultDto {
  orderNumber: string;
  trackingToken: string;
  guestTrackingEnabled: boolean;
  confirmationEmailSent: boolean;
  total: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  hasInventoryReservations: boolean;
}
