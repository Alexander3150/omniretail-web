import type { PermissionDefinition } from "@/shared/types/permissions.types";

export const posPermissions = [
  {
    key: "pos.sales.create",
    module: "pos",
    name: "Crear ventas",
    description: "Permite registrar ventas.",
  },
  {
    key: "pos.sales.read",
    module: "pos",
    name: "Leer ventas",
    description: "Permite consultar ventas.",
  },
  {
    key: "pos.cash.open",
    module: "pos",
    name: "Abrir caja",
    description: "Permite abrir turno de caja.",
  },
  {
    key: "pos.cash.close",
    module: "pos",
    name: "Cerrar caja",
    description: "Permite cerrar turno de caja.",
  },
  {
    key: "pos.returns.create",
    module: "pos",
    name: "Crear devoluciones",
    description: "Permite registrar devoluciones.",
  },
] satisfies PermissionDefinition[];
