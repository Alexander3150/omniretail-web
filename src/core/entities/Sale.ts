import type { SaleStatus } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";
import type { SaleItem } from "@/core/entities/SaleItem";

export interface Sale {
  id: string;
  tenantId: string;
  branchId: string;
  number: string;
  customerId?: string;
  cashShiftId: string;
  items: SaleItem[];
  status: SaleStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  createdByUserId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
