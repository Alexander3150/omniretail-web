import type { CatalogImageSource } from "@/core/entities";

export interface StorefrontCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageSource?: CatalogImageSource;
}

export interface StorefrontDiscoveryProductDto {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  salePrice: number;
  categoryId: string;
  categoryName?: string;
  imageSource?: CatalogImageSource;
  imageAlt?: string;
  /** null means the product does not consume tracked stock (for example a service). */
  availableQuantity: number | null;
}

export interface StorefrontDiscoveryDto {
  categories: StorefrontCategoryDto[];
  products: StorefrontDiscoveryProductDto[];
}
