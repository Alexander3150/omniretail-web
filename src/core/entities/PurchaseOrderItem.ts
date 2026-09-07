export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
  subtotal: number;
}
