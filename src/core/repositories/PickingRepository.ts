import type { PickingItem, PickingOrder } from "@/core/entities";
import type { PickingItemStatus, PickingStatus } from "@/core/enums";

type PickingItemMetadataUpdate = Partial<
  Pick<PickingItem, "locationId" | "lotId" | "serialNumbers">
> & { status?: PickingItemStatus };

export type UpdatePickingItemInput = PickingItemMetadataUpdate &
  (
    | {
        pickedQuantity: number;
        operationId: string;
        performedByUserId: string;
      }
    | {
        pickedQuantity?: undefined;
        operationId?: never;
        performedByUserId?: never;
      }
  );

export interface PickingRepository {
  getAll(): Promise<PickingOrder[]>;
  getById(id: string): Promise<PickingOrder | null>;
  getByOrder(orderId: string): Promise<PickingOrder | null>;
  getQueue(): Promise<PickingOrder[]>;
  create(input: Omit<PickingOrder, "id" | "createdAt" | "updatedAt">): Promise<PickingOrder>;
  assign(id: string, userId: string): Promise<PickingOrder>;
  updateStatus(id: string, status: PickingStatus): Promise<PickingOrder>;
  updateItem(id: string, input: UpdatePickingItemInput): Promise<PickingItem>;
}
