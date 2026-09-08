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
    ],
  },
] satisfies NavigationItem[];
