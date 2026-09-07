import type { PermissionDefinition } from "@/shared/types/permissions.types";

export const logisticsPermissions = [
  {
    key: "logistics.picking.read",
    module: "logistics",
    name: "Leer picking",
    description: "Permite consultar picking.",
  },
  {
    key: "logistics.picking.start",
    module: "logistics",
    name: "Iniciar picking",
    description: "Permite iniciar picking.",
  },
  {
    key: "logistics.picking.complete",
    module: "logistics",
    name: "Completar picking",
    description: "Permite completar picking.",
  },
  {
    key: "logistics.dispatch.read",
    module: "logistics",
    name: "Leer despachos",
    description: "Permite consultar despachos.",
  },
  {
    key: "logistics.dispatch.confirm",
    module: "logistics",
    name: "Confirmar despachos",
    description: "Permite confirmar despachos.",
  },
] satisfies PermissionDefinition[];
