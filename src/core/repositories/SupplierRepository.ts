import type { Supplier, SupplierProduct } from "@/core/entities";
export interface SupplierRepository {
  getAll(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  getActive(): Promise<Supplier[]>;
  /** Tenant-scoped read: only active suppliers belonging to `tenantId`. Use for any flow driven by UI input. */
  getActiveByTenant(tenantId: string): Promise<Supplier[]>;
  /**
   * Tenant-scoped, todos los status (mismo patron que PurchaseOrderRepository/BranchRepository.
   * listByTenant) -- permission-hardening PR #98: GetPurchaseOrdersReadModelService usaba
   * getAll() sin filtro de tenant, exponiendo suppliers de todos los tenants en el read model.
   * A diferencia de `getActiveByTenant` (solo activos, pensado para dropdowns de alta), este
   * incluye archivados: un read model de ordenes ya existentes debe poder resolver el nombre de
   * un proveedor archivado, no solo de los que se pueden elegir para una orden nueva.
   */
  listByTenant(tenantId: string): Promise<Supplier[]>;
  getProductsBySupplier(supplierId: string): Promise<SupplierProduct[]>;
  create(
    input: Omit<Supplier, "id" | "createdAt" | "updatedAt" | "leadTimeDays">,
  ): Promise<Supplier>;
  update(
    id: string,
    input: Partial<Omit<Supplier, "id" | "createdAt" | "updatedAt" | "leadTimeDays">>,
  ): Promise<Supplier>;
  archive(id: string): Promise<Supplier>;
}
