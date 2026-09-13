import { administrationNavigation } from "@/modules/administration/navigation";
import { authNavigation } from "@/modules/auth/navigation";
import { EMPLOYEE_HOME_ACCESS_PERMISSION } from "@/modules/auth/permissions";
import { customerNavigation } from "@/modules/customer/navigation";
import { inventoryNavigation } from "@/modules/inventory/navigation";
import { logisticsNavigation } from "@/modules/logistics/navigation";
import { posNavigation } from "@/modules/pos/navigation";
import { purchasingNavigation } from "@/modules/purchasing/navigation";
import { receivingNavigation } from "@/modules/receiving/navigation";
import { storefrontNavigation } from "@/modules/storefront/navigation";
import type { NavigationItem } from "@/shared/types/navigation.types";

export const baseNavigation = [
  {
    id: "home",
    label: "Inicio",
    href: "/inicio",
    permission: EMPLOYEE_HOME_ACCESS_PERMISSION,
  },
] satisfies NavigationItem[];

export const navigationConfig = [
  ...baseNavigation,
  ...authNavigation,
  ...customerNavigation,
  ...storefrontNavigation,
  ...administrationNavigation,
  ...inventoryNavigation,
  ...purchasingNavigation,
  ...receivingNavigation,
  ...posNavigation,
  ...logisticsNavigation,
] satisfies NavigationItem[];
