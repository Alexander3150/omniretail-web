import type { Product } from "@/core/entities";

export interface StorefrontCartItemDto {
  productId: string;
  tenantId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export function createStorefrontCartItem(product: Product): StorefrontCartItemDto {
  return {
    productId: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    name: product.name,
    unitPrice: product.salePrice,
    quantity: 1,
  };
}
