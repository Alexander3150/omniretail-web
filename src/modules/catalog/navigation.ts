import type { NavigationItem } from "@/shared/types/navigation.types";

export const catalogNavigation = [
  {
    id: "catalog-products",
    label: "Catálogo y precios",
    href: "/catalogo/productos",
    permission: "catalog.products.read",
  },
] satisfies NavigationItem[];
