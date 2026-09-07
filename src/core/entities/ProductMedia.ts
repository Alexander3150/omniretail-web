import type { ISODateString } from "@/core/types/common.types";

export type ProductMediaType = "image" | "video";

export interface ProductMedia {
  id: string;
  tenantId: string;
  productId: string;
  type: ProductMediaType;
  url: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: ISODateString;
}
