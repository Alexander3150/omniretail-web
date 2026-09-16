"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { PrivateShell } from "@/shared/navigation/PrivateShell";
import type { NavigationItem } from "@/shared/types/navigation.types";

interface CustomerAccountShellProps {
  children: ReactNode;
  navigationItems: NavigationItem[];
}

/**
 * Version de AuthorizedPrivateShell dedicada a Customer. Reutiliza los
 * mismos bloques visuales sin logica de negocio (PrivateShell -> Sidebar +
 * PrivateHeader, ver shared/navigation) que el backoffice de Employee/
 * Admin, pero es un componente PROPIO del modulo customer: nunca importa
 * ni depende de AuthorizedPrivateShell. Mi Cuenta no queda acoplada al
 * shell operativo de backoffice (un cambio ahi no afecta a Customer y
 * viceversa) aunque el resultado visual sea identico -- ese resultado
 * visual es intencional, es el diseño que el negocio ya aprobo.
 *
 * BranchSelector (dentro de PrivateHeader) ya esta pensado para una
 * sesion sin sucursal operacional (ver ScopedActiveBranchProvider): un
 * Customer simplemente ve "Sin sucursales" en vez de romper o mostrar una
 * sucursal arbitraria.
 */
export function CustomerAccountShell({ children, navigationItems }: CustomerAccountShellProps) {
  const { permissions, user } = useCurrentSession();
  const repositories = useRepositories();
  const router = useRouter();

  const allowedPermissions = useMemo(() => new Set(permissions), [permissions]);

  const handleLogout = useCallback(async () => {
    try {
      const sessionId = await repositories.auth.getCurrentSessionId();
      if (sessionId) {
        await repositories.auth.logout(sessionId);
      }
    } finally {
      // Misma garantia que AuthorizedPrivateShell: la limpieza local de la
      // sesion y la navegacion a /iniciar-sesion ocurren pase lo que pase
      // con la revocacion remota.
      await repositories.auth.clearLocalSession();
      router.replace("/iniciar-sesion");
    }
  }, [repositories, router]);

  return (
    <PrivateShell
      allowedPermissions={allowedPermissions}
      homeHref="/"
      homeLabel="Volver al inicio"
      navigationItems={navigationItems}
      onLogout={handleLogout}
      userMenuDescription={user?.email}
      userMenuLabel={user?.name}
    >
      {children}
    </PrivateShell>
  );
}
