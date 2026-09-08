import type { PermissionDefinition } from "@/shared/types/permissions.types";

export const catalogPermissions = [
  {
    key: "catalog.products.read",
    module: "catalog",
    name: "Leer productos",
    description: "Permite consultar productos.",
  },
  {
    key: "catalog.products.create",
    module: "catalog",
    name: "Crear productos",
    description: "Permite crear productos.",
  },
  {
    key: "catalog.products.update",
    module: "catalog",
    name: "Actualizar productos",
    description: "Permite actualizar productos.",
  },
  {
    key: "catalog.categories.manage",
    module: "catalog",
    name: "Gestionar categorias",
    description: "Permite administrar categorias.",
  },
  {
    key: "catalog.locations.manage",
    module: "catalog",
    name: "Gestionar ubicaciones",
    description: "Permite administrar ubicaciones.",
  },
] satisfies PermissionDefinition[];
