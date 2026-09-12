import type { PermissionDefinition } from "@/shared/types/permissions.types";

/**
 * La configuracion del negocio es tenant-wide: quien no tenga este permiso no puede modificarla,
 * ni desde la pantalla ni desde ningun otro consumidor del service.
 */
export const BUSINESS_CONFIG_MANAGE_PERMISSION = "admin.business_config.manage";

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
    key: "admin.customers.read",
    module: "administration",
    name: "Leer clientes",
    description: "Permite consultar el directorio de clientes.",
  },
  {
    key: "admin.customers.manage",
    module: "administration",
    name: "Gestionar clientes",
    description: "Permite crear, editar y archivar registros comerciales de clientes.",
  },
  {
    key: "admin.ecommerce_config.manage",
    module: "administration",
    name: "Gestionar diseño e-commerce",
    description: "Permite configurar la tienda en línea del negocio.",
  },
  {
    key: "admin.audit.read",
    module: "administration",
    name: "Leer auditoría",
    description: "Permite consultar el registro de auditoría.",
  },
] satisfies PermissionDefinition[];
