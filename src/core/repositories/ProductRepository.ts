import type { Product } from "@/core/entities";
import type { SalesChannel } from "@/core/enums";

export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getBySku(sku: string): Promise<Product | null>;
  getPublishedForEcommerce(): Promise<Product[]>;
  getAvailableForPos(): Promise<Product[]>;
  getPublishedForChannel(channel: SalesChannel): Promise<Product[]>;
  create(input: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  update(
    id: string,
    input: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Product>;
  archive(id: string): Promise<Product>;
}
