import type { PickingItemStatus } from "@/core/enums";

export interface PickingItem {
  id: string;
  pickingOrderId: string;
  orderItemId: string;
  productId: string;
  requestedQuantity: number;
  pickedQuantity: number;
  locationId?: string;
  lotId?: string;
  serialNumbers?: string[];
  status: PickingItemStatus;
}
