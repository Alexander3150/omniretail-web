"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Branch } from "@/core/entities";
import type { AuthRepository } from "@/core/repositories";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

interface ActiveBranchContextValue {
  branches: Branch[];
  currentBranch: Branch | null;
  loading: boolean;
  setActiveBranchId: (branchId: string) => void;
}

interface ActiveBranchProviderProps {
  /**
   * Optional scoping predicate: when given, only branches it accepts are
   * exposed/selectable (e.g. a Customer session with no operational branch
   * ends up with an empty list, never an arbitrary default). Omitted means
   * unrestricted, matching the previous behavior.
   */
  tenantId: string | null;
  canAccessBranch?: (branch: Branch) => boolean;
  children: ReactNode;
}

const ActiveBranchContext = createContext<ActiveBranchContextValue | null>(null);

/**
 * Pura y exportada para poder testearse sin renderizar React: dado el set de branches
 * accesibles para el User/tenant actual y la seleccion previa, decide cual queda activa.
 * Conserva la seleccion previa SOLO si sigue siendo accesible (evita que una sucursal de OTRO
 * User/tenant -- ej. tras un cambio de sesion -- sobreviva a la reconstruccion); si no, cae a
 * la primera accesible o a null si no hay ninguna ("Sin sucursales", nunca un fallback a todas).
 */
export function selectNextActiveBranchId(
  accessibleBranches: Branch[],
  currentActiveBranchId: string | null,
): string | null {
  if (
    currentActiveBranchId &&
    accessibleBranches.some((branch) => branch.id === currentActiveBranchId)
  ) {
    return currentActiveBranchId;
  }
  return accessibleBranches[0]?.id ?? null;
}

/** Sucursal activa guardada en la sesion actual (backend o mock), o null si no hay. */
async function readSessionActiveBranchId(auth: AuthRepository): Promise<string | null> {
  const sessionId = await auth.getCurrentSessionId();
  if (!sessionId) return null;
  return (await auth.getSession(sessionId))?.activeBranchId ?? null;
}

/** Pura y exportada: defensa en profundidad para setActiveBranchId (ver su uso mas abajo). */
export function isBranchIdSelectable(branches: Branch[], branchId: string): boolean {
  return branches.some((branch) => branch.id === branchId);
}

export function ActiveBranchProvider({
  tenantId,
  canAccessBranch,
  children,
}: ActiveBranchProviderProps) {
  const repositories = useRepositories();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyBranches = useCallback(
    async (activeBranches: Branch[]) => {
      const accessibleBranches = canAccessBranch
        ? activeBranches.filter((branch) => canAccessBranch(branch))
        : activeBranches;
      // Al cargar (sin seleccion previa en memoria) se parte de la sucursal guardada en la sesion,
      // asi se conserva al recargar; solo se persiste si cambia, para no escribir en cada carga.
      const sessionBranchId = await readSessionActiveBranchId(repositories.auth);
      const nextBranchId = selectNextActiveBranchId(
        accessibleBranches,
        activeBranchId ?? sessionBranchId,
      );
      if (nextBranchId && nextBranchId !== sessionBranchId) {
        try {
          await repositories.auth.setActiveBranchId(nextBranchId);
        } catch {
          // Si no se puede guardar, la sucursal igual queda elegida en esta pestaña: el selector
          // no se queda en "Cargando sucursal".
        }
      }
      setBranches(accessibleBranches);
      setActiveBranchId(nextBranchId);
      setLoading(false);
    },
    [activeBranchId, canAccessBranch, repositories.auth],
  );

  // Si la lista de sucursales no se puede leer (p. ej. 403 por falta de permiso), el selector debe
  // salir de "Cargando sucursal" y mostrar "Sin sucursales" en vez de quedarse cargando.
  const clearBranches = useCallback(() => {
    setBranches([]);
    setActiveBranchId(null);
    setLoading(false);
  }, []);

  const reloadBranches = useCallback(async () => {
    if (!tenantId) {
      await applyBranches([]);
      return;
    }
    try {
      const activeBranches = await repositories.branches.getActiveByTenant(tenantId);
      await applyBranches(activeBranches);
    } catch {
      clearBranches();
    }
  }, [applyBranches, clearBranches, repositories, tenantId]);

  useEffect(() => {
    let active = true;
    const request = tenantId
      ? repositories.branches.getActiveByTenant(tenantId)
      : Promise.resolve([]);
    request
      .then(async (activeBranches) => {
        if (!active) return;
        await applyBranches(activeBranches);
      })
      .catch(() => {
        if (active) clearBranches();
      });

    return () => {
      active = false;
    };
  }, [applyBranches, clearBranches, repositories, tenantId]);

  useDataEvent("branch.changed", reloadBranches);

  const currentBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) ?? null,
    [activeBranchId, branches],
  );

  // Defensa en profundidad: aunque hoy el unico consumidor (BranchSelector) solo ofrece
  // branches ya presentes en `branches` (ya filtradas por canAccessBranch), esta funcion es
  // parte del contrato publico del context -- un branchId fuera de `branches` (manipulado o
  // de otro alcance) se ignora en vez de aceptarse silenciosamente.
  const selectActiveBranch = useCallback(
    (branchId: string) => {
      if (!isBranchIdSelectable(branches, branchId)) return;
      void repositories.auth.setActiveBranchId(branchId).then(() => setActiveBranchId(branchId));
    },
    [branches, repositories.auth],
  );

  const value = useMemo<ActiveBranchContextValue>(
    () => ({
      branches,
      currentBranch,
      loading,
      setActiveBranchId: selectActiveBranch,
    }),
    [branches, currentBranch, loading, selectActiveBranch],
  );

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>;
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext);
  if (!context) throw new Error("useActiveBranch must be used inside ActiveBranchProvider");
  return context;
}
