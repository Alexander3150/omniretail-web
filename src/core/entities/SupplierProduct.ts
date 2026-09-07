import type { ISODateString } from "@/core/types/common.types";

export interface SupplierProduct {
  id: string;
  tenantId: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  purchaseUnitId: string;
  purchaseToBaseFactor: number;
  lastCost: number;
  leadTimeDays: number;
  minimumOrderQuantity: number;
  preferred: boolean;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
