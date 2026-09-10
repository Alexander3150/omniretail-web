import { BUSINESS_CONFIG_MANAGE_PERMISSION } from "@/modules/administration/permissions";
import type { NavigationItem } from "@/shared/types/navigation.types";

export const administrationNavigation = [
  {
    id: "administration",
    label: "Administración",
    permission: BUSINESS_CONFIG_MANAGE_PERMISSION,
    children: [
      {
        id: "administration-business-config",
        label: "Configuración del negocio",
        href: "/administracion/configuracion-negocio",
        permission: BUSINESS_CONFIG_MANAGE_PERMISSION,
      },
      {
        id: "administration-suppliers",
        label: "Proveedores",
        href: "/administracion/proveedores",
        permission: "admin.suppliers.manage",
      },
    ],
  },
] satisfies NavigationItem[];
