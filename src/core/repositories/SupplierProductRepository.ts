import type { SupplierCostTier, SupplierProduct } from "@/core/entities";

export interface SupplierProductRepository {
  getByProduct(productId: string): Promise<SupplierProduct[]>;
  getBySupplier(supplierId: string): Promise<SupplierProduct[]>;
  /** Tenant-scoped reads: only relations belonging to `tenantId`. Use for any flow driven by UI input (supplierId/productId manipulable client-side). */
  getByProductForTenant(tenantId: string, productId: string): Promise<SupplierProduct[]>;
  getBySupplierForTenant(tenantId: string, supplierId: string): Promise<SupplierProduct[]>;
  create(input: Omit<SupplierProduct, "id" | "createdAt" | "updatedAt">): Promise<SupplierProduct>;
  update(
    id: string,
    input: Partial<Omit<SupplierProduct, "id" | "createdAt" | "updatedAt">>,
  ): Promise<SupplierProduct>;
  archive(id: string): Promise<SupplierProduct>;
  setPreferred(productId: string, supplierProductId: string): Promise<SupplierProduct>;
  getCostTiers(supplierProductId: string): Promise<SupplierCostTier[]>;
  replaceCostTiers(
    supplierProductId: string,
    tiers: Omit<SupplierCostTier, "id" | "supplierProductId">[],
  ): Promise<SupplierCostTier[]>;
}
