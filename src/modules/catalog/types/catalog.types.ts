import type {
  BusinessCapabilitiesConfig,
  Category,
  InventoryBalance,
  Product,
  Promotion,
  Supplier,
  SupplierProduct,
  Unit,
} from "@/core/entities";
import type { ProductStatus, ProductType } from "@/core/enums";
import type { ProductChannels } from "@/core/entities/Product";
import type { ProductTrackingConfig } from "@/core/types/tracking.types";

export type ProductPromotionFilter = "all" | "with" | "without";
export type ProductChannelKey = keyof ProductChannels;

export interface ProductFiltersState {
  search: string;
  status: "all" | ProductStatus;
  productType: "all" | ProductType;
  categoryId: "all" | string;
  channels: ProductChannelKey[];
  promotion: ProductPromotionFilter;
}

export interface ProductListItem {
  id: string;
  tenantId: string;
  imageUrl: string;
  sku: string;
  barcode?: string;
  name: string;
  brand?: string;
  categoryName: string;
  categoryId: string;
  baseUnitName: string;
  baseUnitId: string;
  productType: ProductType;
  salePrice: number;
  channels: ProductChannels;
  hasActivePromotion: boolean;
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

export interface ProductInventorySummaryItem {
  balance: InventoryBalance;
  branchName: string;
  locationName?: string;
  stockStatus: "Sin stock" | "Bajo" | "Disponible";
}

export interface ProductSupplierSummaryItem {
  supplier: Supplier;
  supplierProduct: SupplierProduct;
  purchaseUnitName?: string;
}

export interface ProductQuickViewModel extends ProductDetailViewModel {
  inventory: ProductInventorySummaryItem[];
  suppliers: ProductSupplierSummaryItem[];
  promotions: Promotion[];
}
