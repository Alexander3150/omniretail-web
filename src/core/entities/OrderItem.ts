export interface OrderItemFulfillmentComponent {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuSnapshot: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  fulfillmentComponents?: OrderItemFulfillmentComponent[];
}
