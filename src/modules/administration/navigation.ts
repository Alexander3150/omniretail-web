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
        id: "administration-customers",
        label: "Clientes",
        href: "/administracion/clientes",
        permission: "admin.customers.read",
      },
    ],
  },
] satisfies NavigationItem[];
