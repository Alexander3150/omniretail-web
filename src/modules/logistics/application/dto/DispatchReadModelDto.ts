import type { DispatchNotificationStatus } from "@/core/repositories";
import type { DispatchStatus, OrderStatus, TransportMode } from "@/core/enums";

export interface DispatchAddressDto {
  recipientName: string;
  recipientPhone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  stateOrDepartment: string | null;
  postalCode: string | null;
  country: string;
  references: string | null;
}

export type DispatchNotificationContactDto =
  | { emailMode: "send"; email: string }
  | { emailMode: "not_applicable" }
  | { emailMode: "legacy_unknown" };

export interface PreparedOrderQueueItemDto {
  orderId: string;
  orderReference: string;
  createdAt: string;
  recipientName: string;
  recipientPhone: string | null;
  address: DispatchAddressDto | null;
  transportMode: TransportMode;
  notificationContact: DispatchNotificationContactDto;
  pickingOrderId: string;
  pickingCompletedAt: string;
}

export interface PreparedOrderDetailDto extends PreparedOrderQueueItemDto {
  orderStatus: OrderStatus;
  pickingStatus: "completed";
}

export interface DispatchNotificationDto {
  id: string;
  recipientEmail: string;
  deliveryStatus: "simulated_sent";
  sentAt: string;
}

export interface DispatchDetailDto extends PreparedOrderDetailDto {
  dispatch: {
    id: string;
    status: DispatchStatus;
    carrierName: string | null;
    trackingNumber: string | null;
    dispatchedAt: string | null;
    deliveredAt: string | null;
    dispatchedByUserId: string | null;
  } | null;
  notification: DispatchNotificationDto | null;
}

export interface ConfirmDispatchCommand {
  orderId: string;
  operationId: string;
  carrierName?: string;
  trackingNumber?: string;
}

export interface ConfirmDispatchResultDto {
  orderId: string;
  orderStatus: OrderStatus;
  dispatchId: string;
  dispatchStatus: DispatchStatus;
  transportMode: TransportMode;
  carrierName: string | null;
  trackingNumber: string | null;
  dispatchedAt: string;
  notificationStatus: DispatchNotificationStatus;
  notification: DispatchNotificationDto | null;
  idempotent: boolean;
}

export interface MarkDispatchDeliveredCommand {
  orderId: string;
}

export interface MarkDispatchDeliveredResultDto {
  orderId: string;
  orderStatus: OrderStatus;
  dispatchId: string;
  dispatchStatus: DispatchStatus;
  deliveredAt: string;
  idempotent: boolean;
}
