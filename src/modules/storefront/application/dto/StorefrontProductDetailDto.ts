import type { Product } from "@/core/entities";

export interface StorefrontBranchAvailabilityDto {
  branchId: string;
  branchName: string;
  address?: string;
  available: boolean;
}

export interface StorefrontProductDetailDto {
  product: Product;
  availability: StorefrontBranchAvailabilityDto[];
}
