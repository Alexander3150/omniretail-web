import type { Supplier, SupplierProduct } from "@/core/entities";
export interface SupplierRepository {
  getAll(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  getActive(): Promise<Supplier[]>;
  getProductsBySupplier(supplierId: string): Promise<SupplierProduct[]>;
  create(input: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Promise<Supplier>;
  update(
    id: string,
    input: Partial<Omit<Supplier, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Supplier>;
  archive(id: string): Promise<Supplier>;
}
