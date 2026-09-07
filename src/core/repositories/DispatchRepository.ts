import type { Dispatch } from "@/core/entities";
import type { DispatchStatus } from "@/core/enums";
export interface DispatchRepository {
  getAll(): Promise<Dispatch[]>;
  getById(id: string): Promise<Dispatch | null>;
  getByOrder(orderId: string): Promise<Dispatch | null>;
  create(input: Omit<Dispatch, "id" | "createdAt" | "updatedAt">): Promise<Dispatch>;
  update(
    id: string,
    input: Partial<Omit<Dispatch, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Dispatch>;
  updateStatus(id: string, status: DispatchStatus): Promise<Dispatch>;
}
