import type { PermissionDefinition } from "@/shared/types/permissions.types";

/**
 * La configuracion del negocio es tenant-wide: quien no tenga este permiso no puede modificarla,
 * ni desde la pantalla ni desde ningun otro consumidor del service.
 */
export const BUSINESS_CONFIG_MANAGE_PERMISSION = "admin.business_config.manage";
export const DASHBOARD_READ_PERMISSION = "admin.dashboard.read";

export const administrationPermissions = [
  {
    key: "admin.users.read",
    module: "administration",
    name: "Leer usuarios",
    description: "Permite consultar usuarios.",
  },
  {
    key: "admin.users.manage",
    module: "administration",
    name: "Gestionar usuarios",
    description: "Permite administrar usuarios.",
  },
  {
    key: "admin.roles.read",
    module: "administration",
    name: "Leer roles",
    description: "Permite consultar roles.",
  },
  {
    key: "admin.roles.manage",
    module: "administration",
    name: "Gestionar roles",
    description: "Permite administrar roles.",
  },
  {
    key: "admin.branches.read",
    module: "administration",
    name: "Leer sucursales",
    description: "Permite consultar sucursales.",
  },
  {
    key: "admin.branches.manage",
    module: "administration",
    name: "Gestionar sucursales",
    description: "Permite administrar sucursales.",
  },
  {
    key: BUSINESS_CONFIG_MANAGE_PERMISSION,
    module: "administration",
    name: "Gestionar configuracion",
    description: "Permite modificar configuracion del negocio.",
  },
  {
    key: "admin.suppliers.manage",
    module: "administration",
    name: "Gestionar proveedores",
    description: "Permite administrar proveedores.",
  },
  {
    key: "admin.bank_accounts.manage",
    module: "administration",
    name: "Gestionar cuentas bancarias",
    description: "Permite administrar cuentas bancarias simuladas.",
  },
  {
    key: DASHBOARD_READ_PERMISSION,
    module: "administration",
    name: "Ver dashboard",
    description: "Permite ver el resumen ejecutivo del negocio.",
  },
] satisfies PermissionDefinition[];
