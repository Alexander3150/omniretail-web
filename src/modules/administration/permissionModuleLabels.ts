import type { PermissionDefinition } from "@/shared/types/permissions.types";

export const permissionModuleLabels: Record<string, string> = {
  auth: "Autenticación",
  customer: "Cliente (self-service)",
  storefront: "Storefront",
  administration: "Administración",
  catalog: "Catálogo",
  inventory: "Inventario",
  purchasing: "Compras",
  receiving: "Recepción",
  pos: "POS",
  logistics: "Logística",
};

/** Agrupa una lista de permisos por `module`, preservando el orden de aparición. */
export function groupPermissionsByModule(
  permissions: readonly PermissionDefinition[],
): [string, PermissionDefinition[]][] {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const permission of permissions) {
    const group = groups.get(permission.module) ?? [];
    group.push(permission);
    groups.set(permission.module, group);
  }
  return [...groups.entries()];
}
