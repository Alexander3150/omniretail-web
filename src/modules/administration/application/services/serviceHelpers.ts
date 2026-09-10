import type { Supplier } from "@/core/entities";
import { BUSINESS_CONFIG_MANAGE_PERMISSION } from "@/modules/administration/permissions";

export class AdministrationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdministrationServiceError";
  }
}

/**
 * El permiso se verifica en la capa de aplicacion, no en la pantalla: ocultar el menu o el boton no
 * es enforcement, y la configuracion afecta a todo el tenant.
 */
export function ensureCanManageBusinessConfig(permissions: readonly string[]) {
  if (permissions.includes(BUSINESS_CONFIG_MANAGE_PERMISSION)) return;

  throw new AdministrationServiceError(
    "No tenés permiso para modificar la configuración del negocio.",
  );
}

export function ensureCanManageSuppliers(permissions: readonly string[]) {
  if (permissions.includes("admin.suppliers.manage")) return;

  throw new AdministrationServiceError("No tenés permiso para gestionar proveedores.");
}

export function ensureSupplierTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureSupplierActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureSupplierBelongsToTenant(
  supplier: Supplier | null,
  tenantId: string,
): Supplier {
  if (supplier?.tenantId === tenantId) return supplier;

  throw new AdministrationServiceError("El proveedor no está disponible para el negocio activo.");
}

export function cleanError(error: unknown): string {
  if (error instanceof AdministrationServiceError) return error.message;
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
