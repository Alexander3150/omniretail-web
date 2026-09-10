"use client";

import { useMemo, type ReactNode } from "react";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { EMPLOYEE_HOME_ACCESS_PERMISSION, hasEmployeeHomeAccess } from "@/modules/auth/permissions";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { NavigationItem } from "@/shared/types/navigation.types";

interface AuthorizedPrivateShellProps {
  children: ReactNode;
  navigationItems: NavigationItem[];
}

/**
 * Conecta el PrivateShell (shared, sin logica de negocio) con los permisos
 * reales de la sesion autenticada -- misma fuente (Role.permissions via
 * permissions/hasPermission, mas el permission sintetico de /inicio) que
 * usa RequirePermission para bloquear rutas, para que sidebar y
 * autorizacion de rutas nunca queden desincronizados.
 */
export function AuthorizedPrivateShell({ children, navigationItems }: AuthorizedPrivateShellProps) {
  const { permissions, user } = useCurrentSession();
  const allowedPermissions = useMemo(() => {
    const set = new Set(permissions);
    if (hasEmployeeHomeAccess(user, permissions)) {
      set.add(EMPLOYEE_HOME_ACCESS_PERMISSION);
    }
    return set;
  }, [permissions, user]);

  return (
    <PrivateShell allowedPermissions={allowedPermissions} navigationItems={navigationItems}>
      {children}
    </PrivateShell>
  );
}
