export type DataEventName =
  | "auth.changed"
  | "user.changed"
  | "branch.changed"
  | "business-config.changed"
  | "product.changed"
  | "product-price.changed"
  | "product-sales-price-tier.changed"
  | "category.changed"
  | "promotion.changed"
  | "unit-conversion.changed"
  | "inventory.changed"
  | "inventory-adjustment.changed"
  | "inventory-transfer.changed"
  | "inventory-transfer-request.changed"
  | "stock.changed"
  | "supplier.changed"
  | "supplier-product.changed"
  | "purchase-order.changed"
  | "receipt.changed"
  | "incident-type.changed"
  | "customer.changed"
  | "customer-payment-method.changed"
  | "address.changed"
  | "order.changed"
  | "payment.changed"
  | "sale.changed"
  | "sale.returned"
  | "sale.voided"
  | "cash-shift.changed"
  | "picking.changed"
  | "dispatch.changed"
  | "notification.changed"
  | "audit.changed"
  | "role.changed";

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
