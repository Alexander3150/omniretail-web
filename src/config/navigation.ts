import { administrationNavigation } from "@/modules/administration/navigation";
import { authNavigation } from "@/modules/auth/navigation";
import { catalogNavigation } from "@/modules/catalog/navigation";
import { customerNavigation } from "@/modules/customer/navigation";
import { inventoryNavigation } from "@/modules/inventory/navigation";
import { logisticsNavigation } from "@/modules/logistics/navigation";
import { posNavigation } from "@/modules/pos/navigation";
import { purchasingNavigation } from "@/modules/purchasing/navigation";
import { receivingNavigation } from "@/modules/receiving/navigation";
import { storefrontNavigation } from "@/modules/storefront/navigation";
import type { NavigationItem } from "@/shared/types/navigation.types";

export const navigationConfig = [
  ...authNavigation,
  ...customerNavigation,
  ...storefrontNavigation,
  ...administrationNavigation,
  ...catalogNavigation,
  ...inventoryNavigation,
  ...purchasingNavigation,
  ...receivingNavigation,
  ...posNavigation,
  ...logisticsNavigation,
] satisfies NavigationItem[];
