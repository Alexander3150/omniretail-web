"use client";

import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";

/**
 * Fuente única de `canRead`/`canCreate`/`canUpdate` para las 3 keys canónicas de Products
 * (catalog.products.read/create/update) -- compartida por ProductsPage, ProductDetailPage y
 * ProductFormPage (que usan hooks de datos distintos: useProducts/useProductDetail/
 * useProductEditorData), para no duplicar la misma lógica de permisos en cada uno. `.create`/
 * `.update` implican `.read`, mismo criterio que Categorías/Ubicaciones/Unidades.
 */
export function useProductPermissions() {
  const { hasPermission } = useCurrentSession();
  const canCreate = hasPermission("catalog.products.create");
  const canUpdate = hasPermission("catalog.products.update");
  const canRead = hasPermission("catalog.products.read") || canCreate || canUpdate;

  return { canRead, canCreate, canUpdate };
}
