import type { NavigationItem } from "@/shared/types/navigation.types";

export const catalogNavigation = [
  {
    id: "catalog",
    label: "Catálogo y precios",
    permission: "catalog.products.read",
    children: [
      {
        id: "catalog-products",
        label: "Productos",
        href: "/catalogo/productos",
        permission: "catalog.products.read",
      },
      {
        id: "catalog-categories",
        label: "Categorias",
        href: "/catalogo/categorias",
        permission: "catalog.categories.manage",
      },
    ],
  },
] satisfies NavigationItem[];
