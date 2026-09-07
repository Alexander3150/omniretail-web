import type { NavigationItem } from "@/shared/types/navigation.types";

export const catalogNavigation = [
  {
    label: "Catalogo y precios",
    href: "/catalogo/productos",
    permissionKey: "catalog.products.read",
  },
] satisfies NavigationItem[];
