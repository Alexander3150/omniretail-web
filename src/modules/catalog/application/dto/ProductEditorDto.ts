import type {
  AttributeDefinition,
  ProductMedia,
  Product,
  ProductInventorySettings,
  ProductSalesPriceTier,
  StorageLocation,
  Supplier,
  SupplierCostTier,
  SupplierProduct,
  UnitConversion,
} from "@/core/entities";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
import type { ProductDetailViewModel } from "@/modules/catalog/types/catalog.types";
import type { NumericInputValue } from "@/shared/utils/numberInput";

export interface ProductAttributeEditorValue {
  attributeDefinitionId?: string;
  name: string;
  value: string;
}

export type ProductSalesPriceTierEditorValue = Omit<
  Pick<ProductSalesPriceTier, "minQuantity" | "unitPrice" | "active">,
  "minQuantity" | "unitPrice"
> & {
  id?: string;
  minQuantity: NumericInputValue;
  unitPrice: NumericInputValue;
};

export type SupplierCostTierEditorValue = Omit<
  Pick<SupplierCostTier, "minQuantity" | "unitCost">,
  "minQuantity" | "unitCost"
> & {
  id?: string;
  minQuantity: NumericInputValue;
  unitCost: NumericInputValue;
};

export type SupplierProductEditorValue = Omit<
  Pick<
    SupplierProduct,
    | "supplierId"
    | "supplierSku"
    | "purchaseUnitId"
    | "lastCost"
    | "leadTimeDays"
    | "minimumOrderQuantity"
    | "preferred"
    | "active"
  >,
  "lastCost" | "minimumOrderQuantity"
> & {
  id?: string;
  purchaseToBaseFactor: NumericInputValue;
  lastCost: NumericInputValue;
  minimumOrderQuantity: NumericInputValue;
  costTiers: SupplierCostTierEditorValue[];
};

export type ProductMediaEditorValue = Pick<
  ProductMedia,
  "type" | "url" | "alt" | "isPrimary" | "sortOrder"
> & {
  id?: string;
};

export interface ProductInventorySettingsEditorValue {
  branchId: string;
  minStock: NumericInputValue;
  defaultLocationId: string;
}

export interface ProductKitComponentEditorValue {
  componentProductId: string;
  quantityPerKit: NumericInputValue;
}

export interface ProductEditorDto extends Omit<CreateProductDto, "primaryImageUrl" | "salePrice"> {
  salePrice: NumericInputValue;
  inventoryQuantity: NumericInputValue;
  saleQuantity: NumericInputValue;
  inventorySettings: ProductInventorySettingsEditorValue;
  attributes: ProductAttributeEditorValue[];
  salesPriceTiers: ProductSalesPriceTierEditorValue[];
  supplierProducts: SupplierProductEditorValue[];
  media: ProductMediaEditorValue[];
  kitComponents: ProductKitComponentEditorValue[];
}

export interface ProductEditorData {
  detail: ProductDetailViewModel | null;
  unitConversion: UnitConversion | null;
  inventorySettings: ProductInventorySettings | null;
  storageLocations: StorageLocation[];
  currentDefaultLocation: StorageLocation | null;
  attributeDefinitions: AttributeDefinition[];
  attributes: ProductAttributeEditorValue[];
  salesPriceTiers: ProductSalesPriceTierEditorValue[];
  suppliers: Supplier[];
  supplierProducts: SupplierProductEditorValue[];
  media: ProductMediaEditorValue[];
  promotionCount: number;
  kitComponents: ProductKitComponentEditorValue[];
  kitEligibleProducts: Product[];
}
