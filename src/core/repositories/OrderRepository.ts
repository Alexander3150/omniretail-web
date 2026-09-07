import type { Order } from "@/core/entities";
import type { OrderStatus } from "@/core/enums";
export interface OrderRepository {
  getAll(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  getByTrackingToken(trackingToken: string): Promise<Order | null>;
  getByCustomer(customerId: string): Promise<Order[]>;
  getPendingForLogistics(): Promise<Order[]>;
  create(input: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<Order>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
}
