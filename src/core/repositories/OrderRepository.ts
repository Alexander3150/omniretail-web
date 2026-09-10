import type { Order, OrderItem } from "@/core/entities";
import type { OrderStatus } from "@/core/enums";

export type CreateOrderInput = Omit<
  Order,
  "id" | "items" | "idempotencyKey" | "idempotencyFingerprint" | "createdAt" | "updatedAt"
> & {
  items: Array<Omit<OrderItem, "orderId">>;
  idempotencyKey?: string;
};

export interface OrderRepository {
  getAll(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  getByTrackingToken(trackingToken: string): Promise<Order | null>;
  getByCustomer(customerId: string): Promise<Order[]>;
  getPendingForLogistics(): Promise<Order[]>;
  create(input: CreateOrderInput): Promise<Order>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
}
