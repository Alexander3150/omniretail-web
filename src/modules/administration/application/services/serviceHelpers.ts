import type { Customer } from "@/core/entities";
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

export function ensureCanReadCustomers(permissions: readonly string[]) {
  if (
    permissions.includes("admin.customers.read") ||
    permissions.includes("admin.customers.manage")
  ) {
    return;
  }

  throw new AdministrationServiceError("No tenés permiso para consultar clientes.");
}

export function ensureCanManageCustomers(permissions: readonly string[]) {
  if (permissions.includes("admin.customers.manage")) return;

  throw new AdministrationServiceError("No tenés permiso para gestionar clientes.");
}

export function ensureCustomerTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureCustomerActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureCustomerBelongsToTenant(
  customer: Customer | null,
  tenantId: string,
): Customer {
  if (customer?.tenantId === tenantId) return customer;

  throw new AdministrationServiceError("El cliente no está disponible para el negocio activo.");
}

export function ensureUniqueCustomer(
  customers: Customer[],
  tenantId: string,
  code: string,
  email: string,
  excludedCustomerId?: string,
) {
  const tenantCustomers = customers.filter(
    (customer) => customer.tenantId === tenantId && customer.id !== excludedCustomerId,
  );

  if (tenantCustomers.some((customer) => customer.code.trim().toUpperCase() === code)) {
    throw new AdministrationServiceError("Ya existe un cliente con ese código.");
  }
  if (tenantCustomers.some((customer) => customer.email.trim().toLowerCase() === email)) {
    throw new AdministrationServiceError("Ya existe un cliente con ese correo electrónico.");
  }
}

export function cleanError(error: unknown): string {
  if (error instanceof AdministrationServiceError) return error.message;
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
