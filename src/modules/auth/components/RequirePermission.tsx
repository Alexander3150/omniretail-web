"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationConfig } from "@/config/navigation";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { isNavigationItemActive } from "@/shared/navigation/Sidebar";
import type { NavigationItem } from "@/shared/types/navigation.types";

function findRequiredPermission(items: NavigationItem[], pathname: string): string | undefined {
  for (const item of items) {
    if (item.href && isNavigationItemActive(pathname, item.href)) {
      return item.permission;
    }
    if (item.children) {
      const childPermission = findRequiredPermission(item.children, pathname);
      if (childPermission !== undefined) return childPermission;
    }
  }
  return undefined;
}

/**
 * Boundary de autorizacion por ruta: reutiliza la MISMA fuente de permisos
 * que Sidebar (navigationConfig + isNavigationItemActive) en vez de mantener
 * un segundo mapeo ruta->permiso. Una ruta sin item de navegacion asociado
 * (p.ej. /inicio, /cuenta) no exige permiso -- solo sesion valida, ya
 * garantizada por RequireSession mas arriba en el arbol.
 */
export function RequirePermission({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentSession();
  const requiredPermission = findRequiredPermission(navigationConfig, pathname);

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          No tienes permiso para acceder a esta seccion.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
