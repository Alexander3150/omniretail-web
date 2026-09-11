"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationConfig } from "@/config/navigation";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { EMPLOYEE_HOME_ACCESS_PERMISSION, hasEmployeeHomeAccess } from "@/modules/auth/permissions";
import { isNavigationItemActive } from "@/shared/navigation/Sidebar";
import type { NavigationItem } from "@/shared/types/navigation.types";

/**
 * Rutas privadas que solo exigen sesion valida, sin permiso operacional.
 * Lista explicita y minima -- NUNCA "cualquier ruta sin permission
 * declarado se permite". Todo lo demas que no resuelva un permiso real
 * en navigationConfig queda denegado por defecto (fail-closed), incluidas
 * rutas nuevas/dinamicas que accidentalmente no se hayan registrado.
 *
 * /cuenta NO esta aca: su item en customerNavigation ya declara
 * `permission: "customer.account.read"`, asi que el mecanismo generico de
 * abajo (findRequiredPermission + hasPermission) la protege igual que
 * cualquier otra ruta -- una excepcion "solo sesion" hubiera sido
 * redundante con esa permission real y hubiera dejado un segundo camino
 * de autorizacion mas permisivo para la misma ruta. Vacio hoy, se deja el
 * mecanismo por si una ruta genuinamente sin permiso operacional lo
 * necesita a futuro.
 */
const SESSION_ONLY_ROUTES: string[] = [];

function isSessionOnlyRoute(pathname: string): boolean {
  return SESSION_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

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

function Denied() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-[var(--color-text-muted)]">
        No tienes permiso para acceder a esta seccion.
      </p>
    </div>
  );
}

/**
 * Boundary de autorizacion por ruta, fail-closed por defecto: una ruta
 * privada sin item de navegacion asociado, o cuyo item no resuelve un
 * permiso concedido, se deniega -- nunca se permite por "no encontre
 * permission". Reutiliza la MISMA fuente que Sidebar (navigationConfig +
 * isNavigationItemActive), asi que un item nuevo agregado ahi queda
 * protegido automaticamente sin tocar este archivo.
 *
 * /inicio usa el permission sintetico EMPLOYEE_HOME_ACCESS_PERMISSION
 * (ver modules/auth/permissions.ts) -- mismo mecanismo, sin caso especial
 * duplicado entre sidebar y guard de rutas.
 */
export function RequirePermission({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission, permissions, user } = useCurrentSession();

  if (isSessionOnlyRoute(pathname)) {
    return <>{children}</>;
  }

  const requiredPermission = findRequiredPermission(navigationConfig, pathname);
  const isAllowed =
    requiredPermission === EMPLOYEE_HOME_ACCESS_PERMISSION
      ? hasEmployeeHomeAccess(user, permissions)
      : requiredPermission
        ? hasPermission(requiredPermission)
        : false;

  return isAllowed ? <>{children}</> : <Denied />;
}
