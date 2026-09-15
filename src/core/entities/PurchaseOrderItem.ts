export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitId: string;
  /** Historical conversion captured when the purchase-order line is saved. */
  purchaseToBaseFactor: number;
  unitCost: number;
  subtotal: number;
}
