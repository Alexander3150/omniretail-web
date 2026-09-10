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
        id: "administration-ecommerce-config",
        label: "Diseño E-commerce",
        href: "/administracion/diseno-ecommerce",
        permission: "admin.ecommerce_config.manage",
      },
    ],
  },
] satisfies NavigationItem[];
