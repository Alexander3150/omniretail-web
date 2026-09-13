import type { Dispatch, Notification, Order } from "@/core/entities";

export interface DispatchReadScope {
  tenantId: string;
  branchId?: string;
}

export interface ConfirmDispatchInput {
  tenantId: string;
  branchId: string;
  actorUserId: string;
  orderId: string;
  operationId: string;
  carrierName?: string;
  trackingNumber?: string;
}

export type DispatchNotificationStatus =
  "simulated_sent" | "not_applicable" | "legacy_unknown_skipped";

export interface ConfirmDispatchResult {
  dispatch: Dispatch;
  order: Order;
  notification?: Notification;
  notificationStatus: DispatchNotificationStatus;
  idempotent: boolean;
}

export interface DispatchRepository {
  getAll(scope: DispatchReadScope): Promise<Dispatch[]>;
  getById(scope: DispatchReadScope, id: string): Promise<Dispatch | null>;
  getByOrder(scope: DispatchReadScope, orderId: string): Promise<Dispatch | null>;
  confirm(input: ConfirmDispatchInput): Promise<ConfirmDispatchResult>;
}
