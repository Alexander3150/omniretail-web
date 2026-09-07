import type { ISODateString } from "@/core/types/common.types";

export interface SupplierProduct {
  id: string;
  tenantId: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  purchaseUnitId?: string;
  lastCost?: number;
  leadTimeDays?: number;
  minimumOrderQuantity?: number;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
