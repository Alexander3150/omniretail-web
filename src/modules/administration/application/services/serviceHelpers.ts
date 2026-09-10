import {
  BUSINESS_CONFIG_MANAGE_PERMISSION,
  REPORTS_EXPORT_PERMISSION,
  REPORTS_READ_PERMISSION,
} from "@/modules/administration/permissions";

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

export function ensureCanReadReports(permissions: readonly string[]) {
  if (permissions.includes(REPORTS_READ_PERMISSION)) return;

  throw new AdministrationServiceError("No tenés permiso para consultar los reportes.");
}

export function ensureCanExportReports(permissions: readonly string[]) {
  if (permissions.includes(REPORTS_EXPORT_PERMISSION)) return;

  throw new AdministrationServiceError("No tenés permiso para exportar reportes.");
}

export function ensureReportsTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function cleanError(error: unknown): string {
  if (error instanceof AdministrationServiceError) return error.message;
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
