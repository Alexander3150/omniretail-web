"use client";

import { useMemo, type ReactNode } from "react";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { NavigationItem } from "@/shared/types/navigation.types";

interface AuthorizedPrivateShellProps {
  children: ReactNode;
  navigationItems: NavigationItem[];
}

/**
 * Conecta el PrivateShell (shared, sin logica de negocio) con los permisos
 * reales de la sesion autenticada -- misma fuente (Role.permissions via
 * hasPermission/permissions) que usa RequirePermission para bloquear rutas,
 * para que sidebar y autorizacion de rutas nunca queden desincronizados.
 */
export function AuthorizedPrivateShell({ children, navigationItems }: AuthorizedPrivateShellProps) {
  const { permissions } = useCurrentSession();
  const allowedPermissions = useMemo(() => new Set(permissions), [permissions]);

  return (
    <PrivateShell allowedPermissions={allowedPermissions} navigationItems={navigationItems}>
      {children}
    </PrivateShell>
  );
}
