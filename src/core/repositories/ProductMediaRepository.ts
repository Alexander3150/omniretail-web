import type { ProductMedia } from "@/core/entities";

export interface ProductMediaRepository {
  getByProduct(productId: string): Promise<ProductMedia[]>;
  getPrimaryByProduct(productId: string): Promise<ProductMedia | null>;
  add(input: Omit<ProductMedia, "id">): Promise<ProductMedia>;
  update(media: ProductMedia): Promise<ProductMedia>;
  remove(id: string): Promise<void>;
  setPrimary(productId: string, mediaId: string): Promise<void>;
}
