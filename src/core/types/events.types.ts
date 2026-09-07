export type DataEventName =
  | "auth.changed"
  | "user.changed"
  | "branch.changed"
  | "business-config.changed"
  | "product.changed"
  | "product-price.changed"
  | "category.changed"
  | "promotion.changed"
  | "inventory.changed"
  | "stock.changed"
  | "supplier.changed"
  | "purchase-order.changed"
  | "receipt.changed"
  | "customer.changed"
  | "order.changed"
  | "payment.changed"
  | "sale.changed"
  | "cash-shift.changed"
  | "picking.changed"
  | "dispatch.changed"
  | "notification.changed"
  | "audit.changed";

export interface DataEventPayload {
  entityId?: string;
  tenantId?: string;
  branchId?: string;
  productId?: string;
  previousPrice?: number;
  newPrice?: number;
  action?: "created" | "updated" | "archived" | "deleted" | "status_changed" | "reset";
  metadata?: Record<string, unknown>;
}
