import type { ProductStatus, ProductType } from "@/core/enums";
import type { ISODateString } from "@/core/types/common.types";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";

export interface ProductChannels {
  ecommerce: boolean;
  pos: boolean;
  mobileApp: boolean;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  productType: ProductType;
  categoryId: string;
  baseUnitId: string;
  salePrice: number;
  status: ProductStatus;
  tracking: ProductTrackingConfig;
  channels: ProductChannels;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
