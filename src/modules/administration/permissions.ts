import type { PermissionDefinition } from "@/shared/types/permissions.types";

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
    key: "admin.business_config.manage",
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
] satisfies PermissionDefinition[];
