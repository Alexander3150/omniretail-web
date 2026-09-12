export interface StorefrontCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
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
  imageUrl?: string;
  imageAlt?: string;
}

export interface StorefrontDiscoveryDto {
  categories: StorefrontCategoryDto[];
  products: StorefrontDiscoveryProductDto[];
}
