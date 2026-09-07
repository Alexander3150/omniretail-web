import type { BusinessCapabilitiesConfig, Category, Product, Unit } from "@/core/entities";
import type { ProductStatus, ProductType } from "@/core/enums";
import type { ProductChannels } from "@/core/entities/Product";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";

export type ProductChannelFilter = "all" | keyof ProductChannels;

export interface ProductFiltersState {
  search: string;
  status: "all" | ProductStatus;
  productType: "all" | ProductType;
  categoryId: "all" | string;
  channel: ProductChannelFilter;
}

export interface ProductListItem {
  id: string;
  imageUrl: string;
  sku: string;
  barcode?: string;
  name: string;
  brand?: string;
  categoryName: string;
  categoryId: string;
  productType: ProductType;
  salePrice: number;
  channels: ProductChannels;
  status: ProductStatus;
  tracking: ProductTrackingConfig;
}

export interface ProductDetailViewModel {
  product: Product;
  imageUrl: string;
  primaryImageUrl: string;
  category: Category | null;
  unit: Unit | null;
}

export interface ProductFormOptions {
  categories: Category[];
  units: Unit[];
  businessCapabilities: BusinessCapabilitiesConfig;
}
