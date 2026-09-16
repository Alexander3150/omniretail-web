import type { PurchaseOrder, PurchaseOrderItem } from "@/core/entities";
import type { PurchaseOrderStatus } from "@/core/enums";

export type PurchaseOrderItemInput = Omit<PurchaseOrderItem, "id" | "purchaseOrderId">;

export type CreatePurchaseOrderInput = Omit<
  PurchaseOrder,
  "id" | "number" | "items" | "createdAt" | "updatedAt"
> & {
  number?: string;
  items?: PurchaseOrderItemInput[];
};

export type UpdatePurchaseOrderInput = Partial<
  Omit<PurchaseOrder, "id" | "items" | "createdAt" | "updatedAt">
> & {
  items?: PurchaseOrderItemInput[];
};

export interface PurchaseOrderRepository {
  getAll(): Promise<PurchaseOrder[]>;
  getById(id: string): Promise<PurchaseOrder | null>;
  /**
   * Tenant-scoped, mismo patron que RoleRepository/BranchRepository -- permission-hardening
   * (feature/permission-hardening-purchasing-receiving): GetPurchaseOrdersReadModelService y
   * GetSuppliersReadModelService usaban getAll() sin filtro de tenant, exponiendo ordenes de
   * TODOS los tenants. getAll()/getById() se conservan sin cambios para consumidores fuera de
   * este PR (GetReportsService, GetInventoryMovementsService, PurchaseOrderPdfService) -- el
   * fix vive en los application services de Purchasing/Receiving, no en el contrato existente.
   */
  listByTenant(tenantId: string): Promise<PurchaseOrder[]>;
  getByIdScoped(tenantId: string, id: string): Promise<PurchaseOrder | null>;
  create(input: CreatePurchaseOrderInput): Promise<PurchaseOrder>;
  update(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder>;
  /**
   * Variante tenant-scoped de `update`, para PurchaseOrderEditorService -- antes de este fix, el
   * service validaba tenant por su cuenta (`ensureOrderBelongsToTenant`) y despues llamaba a
   * `update(id, ...)` sin tenant: correcto hoy porque el guard corre justo antes, pero un cambio
   * futuro en el orden de las validaciones lo hubiera vuelto inseguro sin que el repository lo
   * impidiera. `updateScoped` hace la garantia estructural, no solo convencional.
   */
  updateScoped(tenantId: string, id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder>;
  updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder>;
  /**
   * Variante tenant-scoped de `updateStatus` -- cierra el bypass real que tenia
   * `usePurchaseOrders.updateStatus` (llamaba a `updateStatus(id, status)` directo desde el hook,
   * saltandose cualquier Application Service, permiso o validacion de tenant). Ahora es el unico
   * metodo que `UpdatePurchaseOrderStatusService` puede usar para aprobar/cancelar/enviar.
   */
  updateStatusScoped(
    tenantId: string,
    id: string,
    status: PurchaseOrderStatus,
  ): Promise<PurchaseOrder>;
}
