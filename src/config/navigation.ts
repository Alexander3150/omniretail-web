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

/**
 * "Administración" (administrationNavigation) queda fuera a pedido
 * explicito para esta rama/PR (feature/customer-seguridad-soporte):
 * Melbyn la reincorporara al unir esta rama con el resto del trabajo en
 * paralelo. Los archivos de /administracion/* NO se borraron -- pero
 * RequirePermission deniega por defecto cualquier ruta que no resuelva
 * un permiso en este arbol (fail-closed), asi que mientras esto este
 * afuera esas rutas tambien quedan bloqueadas por URL directa, no solo
 * ocultas del Sidebar.
 */
export const navigationConfig = [
  ...baseNavigation,
  ...authNavigation,
  ...customerNavigation,
  ...storefrontNavigation,
  ...inventoryNavigation,
  ...purchasingNavigation,
  ...receivingNavigation,
  ...posNavigation,
  ...logisticsNavigation,
] satisfies NavigationItem[];
