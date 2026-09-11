import type { OrderStatus } from "@/core/enums";

export interface StorefrontOrderTrackingDto {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    subtotal: number;
  }>;
}
