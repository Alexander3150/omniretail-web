import { BUSINESS_CONFIG_MANAGE_PERMISSION } from "@/modules/administration/permissions";
import type { NavigationItem } from "@/shared/types/navigation.types";

export const administrationNavigation = [
  {
    id: "administration",
    label: "Administración",
    permission: BUSINESS_CONFIG_MANAGE_PERMISSION,
    children: [
      {
        id: "administration-branches",
        label: "Sucursales",
        href: "/administracion/sucursales",
        // Navegacion y services comparten semantica: `NavigationItem.permission` es un unico
        // string y no existe un mecanismo de "cualquiera de estos permisos", asi que la entrada
        // se protege con `admin.branches.manage`, el permiso que tiene la audiencia real de la
        // pantalla. Los services siguen aceptando ademas `admin.branches.read` de forma defensiva.
        permission: "admin.branches.manage",
      },
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
        // Mismo caso que Sucursales (ver comentario arriba): la entrada se protege con
        // `admin.customers.manage`, el permiso real de la audiencia. Los services siguen
        // aceptando ademas `admin.customers.read` de forma defensiva para un futuro rol de
        // solo lectura -- ese rol necesitaria igual el permiso literal para ver este item, no
        // hay implicacion automatica manage -> read a nivel de navegacion/rutas.
        permission: "admin.customers.manage",
      },
      {
        id: "administration-bank-accounts",
        label: "Cuentas bancarias",
        href: "/administracion/cuentas-bancarias",
        permission: "admin.bank_accounts.manage",
      },
    ],
  },
] satisfies NavigationItem[];
