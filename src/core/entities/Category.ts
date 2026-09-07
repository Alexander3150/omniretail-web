import type { CategoryStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";

export interface Category {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  slug: string;
  description?: string;
  status: CategoryStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
