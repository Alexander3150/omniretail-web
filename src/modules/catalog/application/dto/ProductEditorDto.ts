import type {
  AttributeDefinition,
  ProductMedia,
  ProductSalesPriceTier,
  Supplier,
  SupplierCostTier,
  SupplierProduct,
  UnitConversion,
} from "@/core/entities";
import type { CreateProductDto } from "@/modules/catalog/application/dto/CreateProductDto";
import type { ProductDetailViewModel } from "@/modules/catalog/types/catalog.types";

export interface ProductAttributeEditorValue {
  attributeDefinitionId?: string;
  name: string;
  value: string;
}

export type ProductSalesPriceTierEditorValue = Pick<
  ProductSalesPriceTier,
  "minQuantity" | "unitPrice" | "active"
> & {
  id?: string;
};

export type SupplierCostTierEditorValue = Pick<SupplierCostTier, "minQuantity" | "unitCost"> & {
  id?: string;
};

export type SupplierProductEditorValue = Pick<
  SupplierProduct,
  | "supplierId"
  | "supplierSku"
  | "purchaseUnitId"
  | "lastCost"
  | "leadTimeDays"
  | "minimumOrderQuantity"
  | "preferred"
  | "active"
> & {
  id?: string;
  purchaseToBaseFactor: number | "";
  costTiers: SupplierCostTierEditorValue[];
};

export type ProductMediaEditorValue = Pick<
  ProductMedia,
  "type" | "url" | "alt" | "isPrimary" | "sortOrder"
> & {
  id?: string;
};

export interface ProductEditorDto extends Omit<CreateProductDto, "primaryImageUrl"> {
  inventoryQuantity: number;
  saleQuantity: number | "";
  attributes: ProductAttributeEditorValue[];
  salesPriceTiers: ProductSalesPriceTierEditorValue[];
  supplierProducts: SupplierProductEditorValue[];
  media: ProductMediaEditorValue[];
}

export interface ProductEditorData {
  detail: ProductDetailViewModel | null;
  unitConversion: UnitConversion | null;
  attributeDefinitions: AttributeDefinition[];
  attributes: ProductAttributeEditorValue[];
  salesPriceTiers: ProductSalesPriceTierEditorValue[];
  suppliers: Supplier[];
  supplierProducts: SupplierProductEditorValue[];
  media: ProductMediaEditorValue[];
  promotionCount: number;
}
