import type { ISODateString } from "@/core/types/common.types";
import type { CatalogImageSource } from "@/core/entities/CatalogImage";

export type ProductMediaType = "image" | "video";

export interface ProductMedia {
  id: string;
  tenantId: string;
  productId: string;
  type: ProductMediaType;
  /** Legacy URL/path. New local assets use `source` and persist an empty URL. */
  url: string;
  source?: CatalogImageSource;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: ISODateString;
}
