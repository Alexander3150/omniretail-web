import type { ProductType } from "@/core/enums";

export interface PosProductDto {
  productId: string;
  sku: string;
  barcode?: string;
  name: string;
  productType: ProductType;
  basePrice: number;
  effectivePrice: number;
  discount: number;
  availableQuantity: number | null;
  tracksStock: boolean;
  requiresLot: boolean;
  requiresSerial: boolean;
  requiresUnsupportedTraceability: boolean;
  isAvailableForSale: boolean;
}
