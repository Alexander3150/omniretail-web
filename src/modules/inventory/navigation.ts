import type { NavigationItem } from "@/shared/types/navigation.types";

export const inventoryNavigation = [
  {
    id: "inventory",
    label: "Inventario",
    permission: "inventory.stock.read",
    children: [
      {
        id: "inventory-alerts",
        label: "Inventario y alertas",
        href: "/inventario/alertas",
        permission: "inventory.stock.read",
      },
      {
        id: "inventory-catalog-pricing",
        label: "Catalogo y precios",
        href: "/catalogo/productos",
        permission: "catalog.products.read",
      },
      {
        id: "inventory-movements",
        label: "Historial de movimientos",
        href: "/inventario/movimientos",
        permission: "inventory.stock.read",
      },
    ],
  },
] satisfies NavigationItem[];
