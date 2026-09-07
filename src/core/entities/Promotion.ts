import type { PromotionStatus, PromotionType } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: PromotionType;
  value: number;
  startAt: ISODateString;
  endAt?: ISODateString;
  untilStockEnds: boolean;
  branchIds: string[];
  productIds: string[];
  status: PromotionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
