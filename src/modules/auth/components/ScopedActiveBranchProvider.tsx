"use client";

import type { ReactNode } from "react";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

/**
 * Conecta ActiveBranchProvider (shared, sin logica de negocio) con el
 * modelo de alcance de sucursal YA EXISTENTE (canAccessBranch, derivado de
 * Role.branchScope) -- un Cliente sin sucursal operacional termina con la
 * lista de branches vacia en vez de recibir la primera activa por defecto.
 */
export function ScopedActiveBranchProvider({ children }: { children: ReactNode }) {
  const { user, role } = useCurrentSession();

  return (
    <ActiveBranchProvider
      tenantId={user?.tenantId ?? null}
      canAccessBranch={(branch) => (user && role ? canUserAccessBranch(user, role, branch) : false)}
    >
      {children}
    </ActiveBranchProvider>
  );
}
