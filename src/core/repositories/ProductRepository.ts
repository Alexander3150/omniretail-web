import type { Product } from "@/core/entities";
import type { SalesChannel } from "@/core/enums";

export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getByTenant(tenantId: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByIdScoped(tenantId: string, id: string): Promise<Product | null>;
  getBySku(sku: string): Promise<Product | null>;
  getBySkuScoped(tenantId: string, sku: string): Promise<Product | null>;
  getPublishedForEcommerce(tenantId: string): Promise<Product[]>;
  getAvailableForPos(): Promise<Product[]>;
  getPublishedForChannel(channel: SalesChannel): Promise<Product[]>;
  create(input: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  update(
    id: string,
    input: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Product>;
  updateScoped(
    tenantId: string,
    id: string,
    input: Partial<Omit<Product, "id" | "tenantId" | "createdAt" | "updatedAt">>,
  ): Promise<Product>;
  archive(id: string): Promise<Product>;
  archiveScoped(tenantId: string, id: string): Promise<Product>;
}
