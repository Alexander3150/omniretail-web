import type { NavigationItem } from "@/shared/types/navigation.types";

export const logisticsNavigation = [
  {
    id: "logistics",
    label: "Logística",
    permission: "logistics.dispatch.read",
    children: [
      {
        id: "logistics-dispatches",
        label: "Packing y Despacho",
        href: "/logistica/despachos",
        permission: "logistics.dispatch.read",
      },
    ],
  },
] satisfies NavigationItem[];
