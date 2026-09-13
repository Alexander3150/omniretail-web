import type { CatalogImageSource, Product } from "@/core/entities";

export interface StorefrontBranchAvailabilityDto {
  branchId: string;
  branchName: string;
  address?: string;
  available: boolean;
}

export interface StorefrontProductDetailDto {
  product: Product;
  categoryName?: string;
  media: Array<{ source: CatalogImageSource; alt?: string }>;
  attributes: Array<{ name: string; value: string }>;
  availability?: StorefrontBranchAvailabilityDto[];
}
