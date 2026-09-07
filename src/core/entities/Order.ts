import type { DeliveryMethod, OrderSource, OrderStatus, TransportMode } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";
import type { AddressSnapshot } from "@/core/types/address.types";
import type { OrderItem } from "@/core/entities/OrderItem";

export interface GuestCustomer {
  name: string;
  email: string;
}

export interface Order {
  id: string;
  tenantId: string;
  branchId: string;
  orderNumber: string;
  source: OrderSource;
  customerId?: string;
  guestCustomer?: GuestCustomer;
  items: OrderItem[];
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  transportMode: TransportMode;
  deliveryAddress?: AddressSnapshot;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  trackingToken: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
