import type { NavigationItem } from "@/shared/types/navigation.types";
import { SaasCapabilityKey } from "@/core/enums";

export const logisticsNavigation = [
  {
    id: "logistics",
    label: "Logística",
    permission: "logistics.dispatch.read",
    children: [
      {
        id: "logistics-dispatches",
        capability: SaasCapabilityKey.delivery,
        label: "Packing y Despacho",
        href: "/logistica/despachos",
        permission: "logistics.dispatch.read",
      },
    ],
  },
] satisfies NavigationItem[];
