import type { Branch, Product, User } from "@/core/entities";
import { canUserOperateBranch } from "@/core/scopes/userBranchAccess";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { resolveCurrentSessionSnapshot } from "@/modules/auth/application/services/resolveCurrentSessionSnapshot";

export const INVENTORY_STOCK_READ_PERMISSION = "inventory.stock.read";
export const INVENTORY_MOVEMENTS_READ_PERMISSION = "inventory.movements.read";
export const INVENTORY_ADJUSTMENT_CREATE_PERMISSION = "inventory.adjustment.create";
export const INVENTORY_TRANSFERS_MANAGE_PERMISSION = "inventory.transfers.manage";

export class InventoryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

export interface InventorySessionContext {
  tenantId: string;
  actorUserId: string;
  user: User;
  permissions: readonly string[];
}

/**
 * Fuente autoritativa para Inventory permission-hardening: tenant, actor, permisos y alcance de
 * sucursales salen de la sesion actual, nunca del DTO ni del hook que llama al service.
 */
export async function resolveInventoryContext(
  repositories: RepositoryRegistry,
): Promise<InventorySessionContext> {
  const snapshot = await resolveCurrentSessionSnapshot(repositories);
  if (!snapshot.user || !snapshot.role) {
    throw new InventoryServiceError(snapshot.error ?? "No se pudo resolver la sesión actual.");
  }
  return {
    tenantId: snapshot.user.tenantId,
    actorUserId: snapshot.user.id,
    user: snapshot.user,
    permissions: snapshot.role.permissions,
  };
}

export function ensureCanReadStock(permissions: readonly string[]) {
  if (permissions.includes(INVENTORY_STOCK_READ_PERMISSION)) return;
  throw new InventoryServiceError("No tenés permiso para consultar stock.");
}

export function ensureCanReadMovements(permissions: readonly string[]) {
  if (permissions.includes(INVENTORY_MOVEMENTS_READ_PERMISSION)) return;
  throw new InventoryServiceError("No tenés permiso para consultar movimientos de inventario.");
}

export function ensureCanCreateAdjustment(permissions: readonly string[]) {
  if (permissions.includes(INVENTORY_ADJUSTMENT_CREATE_PERMISSION)) return;
  throw new InventoryServiceError("No tenés permiso para registrar ajustes de inventario.");
}

export function ensureCanManageTransfers(permissions: readonly string[]) {
  if (permissions.includes(INVENTORY_TRANSFERS_MANAGE_PERMISSION)) return;
  throw new InventoryServiceError("No tenés permiso para gestionar traslados de inventario.");
}

export async function ensureInventoryBranchBelongsToTenant(
  repositories: RepositoryRegistry,
  tenantId: string,
  branchId: string,
): Promise<Branch> {
  const branch = await repositories.branches.getById(branchId);
  if (!branch || branch.tenantId !== tenantId) {
    throw new InventoryServiceError("La sucursal seleccionada no está disponible para este negocio.");
  }
  return branch;
}

export async function ensureUserCanOperateInventoryBranch(
  repositories: RepositoryRegistry,
  user: User,
  branchId: string,
): Promise<Branch> {
  const branch = await ensureInventoryBranchBelongsToTenant(repositories, user.tenantId, branchId);
  if (!canUserOperateBranch(user, branch)) {
    throw new InventoryServiceError("No tenés acceso a la sucursal seleccionada.");
  }
  return branch;
}

export function ensureProductBelongsToTenant(product: Product | null, tenantId: string): Product {
  if (product?.tenantId === tenantId) return product;
  throw new InventoryServiceError("Producto no encontrado.");
}

export function cleanInventoryError(error: unknown, fallback = "No se pudo completar la operación.") {
  if (error instanceof InventoryServiceError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
