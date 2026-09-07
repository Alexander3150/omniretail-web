import type { ProductMedia } from "@/core/entities";

export const PRODUCT_IMAGE_PLACEHOLDER = "/images/products/placeholder-product.webp";

export function getProductImage(media: ProductMedia[]) {
  const sortedMedia = [...media].sort((left, right) => left.sortOrder - right.sortOrder);
  return (
    sortedMedia.find((item) => item.isPrimary)?.url ??
    sortedMedia[0]?.url ??
    PRODUCT_IMAGE_PLACEHOLDER
  );
}
