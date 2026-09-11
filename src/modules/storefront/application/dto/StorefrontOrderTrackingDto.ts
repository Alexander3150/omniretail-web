import type { OrderStatus } from "@/core/enums";

export interface StorefrontOrderTrackingDto {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    subtotal: number;
  }>;
}
