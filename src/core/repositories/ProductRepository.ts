import type { Product } from "@/core/entities";
import type { SalesChannel } from "@/core/enums";
import type { PageParams, PaginatedResult } from "@/core/types/pagination.types";

export type ProductSort =
  | "name,asc"
  | "name,desc"
  | "sku,asc"
  | "sku,desc"
  | "createdAt,asc"
  | "createdAt,desc";

export interface ProductPageParams extends PageParams {
  sort?: ProductSort;
}

export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getByTenant(tenantId: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByIdScoped(tenantId: string, id: string): Promise<Product | null>;
  getBySku(sku: string): Promise<Product | null>;
  getBySkuScoped(tenantId: string, sku: string): Promise<Product | null>;
  getPageScoped(
    tenantId: string,
    params: ProductPageParams,
  ): Promise<PaginatedResult<Product>>;
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
  restore(id: string): Promise<Product>;
  restoreScoped(tenantId: string, id: string): Promise<Product>;
}
