"use client";

import type { ReactNode } from "react";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { canUserOperateBranch } from "@/core/scopes/userBranchAccess";
import { ActiveBranchProvider } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

/**
 * Conecta ActiveBranchProvider (shared, sin logica de negocio) con la fuente autoritativa de
 * alcance OPERATIVO: User.allowedBranchIds (canUserOperateBranch), no Role.branchScope -- un
 * User sin sucursales asignadas termina con la lista vacia ("Sin sucursales"), nunca con un
 * fallback a todas las sucursales del tenant. Deliberadamente ya no depende de `role`: esta
 * fuente es por-User, no por-Role (ver core/scopes/userBranchAccess.ts).
 */
export function ScopedActiveBranchProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentSession();

  return (
    <ActiveBranchProvider
      tenantId={user?.tenantId ?? null}
      canAccessBranch={(branch) => (user ? canUserOperateBranch(user, branch) : false)}
    >
      {children}
    </ActiveBranchProvider>
  );
}
