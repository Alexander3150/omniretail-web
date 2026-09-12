"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Role, User } from "@/core/entities";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { resolveCurrentSessionSnapshot } from "@/modules/auth/application/services/resolveCurrentSessionSnapshot";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

interface CurrentSessionContextValue {
  user: User | null;
  role: Role | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  canAccessBranch: (branchId: string) => boolean;
  loading: boolean;
  isDemo: boolean;
  error?: string;
}

const CurrentSessionContext = createContext<CurrentSessionContextValue | null>(null);

export function CurrentSessionProvider({ children }: { children: ReactNode }) {
  const repositories = useRepositories();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const reloadVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++reloadVersion.current;
    setLoading(true);
    setError(undefined);
    try {
      const snapshot = await resolveCurrentSessionSnapshot(repositories);
      // auth.changed/user.changed y la carga inicial pueden solaparse.
      // Solo la reconstruccion mas reciente puede publicar estado; asi
      // una lectura iniciada con la sesion anterior nunca sobreescribe
      // el resultado de un login/logout posterior.
      if (version !== reloadVersion.current) return;
      setUser(snapshot.user);
      setRole(snapshot.role);
      setError(snapshot.error);
    } catch {
      if (version !== reloadVersion.current) return;
      setUser(null);
      setRole(null);
      setError("No se pudo cargar la sesion actual.");
    } finally {
      if (version === reloadVersion.current) {
        setLoading(false);
      }
    }
  }, [repositories]);

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (!active) return;
      void reload();
    });
    return () => {
      active = false;
    };
  }, [reload]);

  useDataEvent("auth.changed", reload);
  useDataEvent("user.changed", reload);

  const permissions = useMemo(() => role?.permissions ?? [], [role]);
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const value = useMemo<CurrentSessionContextValue>(
    () => ({
      user,
      role,
      permissions,
      hasPermission: (permission) => permissionSet.has(permission),
      canAccessBranch: (branchId) =>
        user && role ? canUserAccessBranch(user, role, branchId) : false,
      loading,
      isDemo: false,
      error,
    }),
    [error, loading, permissionSet, permissions, role, user],
  );

  return <CurrentSessionContext.Provider value={value}>{children}</CurrentSessionContext.Provider>;
}

export function useCurrentSessionContext() {
  const context = useContext(CurrentSessionContext);
  if (!context) throw new Error("useCurrentSession must be used inside CurrentSessionProvider");
  return context;
}
