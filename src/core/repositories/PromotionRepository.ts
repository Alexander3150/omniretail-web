import type { Promotion } from "@/core/entities";
export interface PromotionRepository {
  getAll(): Promise<Promotion[]>;
  getActive(): Promise<Promotion[]>;
  getByProduct(productId: string): Promise<Promotion[]>;
  create(input: Omit<Promotion, "id" | "createdAt" | "updatedAt">): Promise<Promotion>;
  update(
    id: string,
    input: Partial<Omit<Promotion, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Promotion>;
}
