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
import type { Role, User } from "@/core/entities";
import { UserStatus } from "@/core/enums";
import { canUserAccessBranch } from "@/core/scopes/userBranchAccess";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
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

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const sessionId = await repositories.auth.getCurrentSessionId();
      if (!sessionId) {
        setUser(null);
        setRole(null);
        return;
      }

      const session = await repositories.auth.getSession(sessionId);
      if (!session) {
        setUser(null);
        setRole(null);
        return;
      }

      const resolvedUser = await repositories.users.getById(session.userId);

      // Fail-closed: un User desactivado despues de haber iniciado sesion
      // (por un admin, por ejemplo) no debe seguir viendose como
      // autenticado solo porque la sesion en storage sigue vigente. Se
      // trata igual que "sesion invalida", nunca se expone el User ni su
      // Role -- aplica por igual a Employee y Customer.
      if (resolvedUser && resolvedUser.status !== UserStatus.active) {
        setUser(null);
        setRole(null);
        setError("La cuenta ya no esta activa.");
        return;
      }

      const resolvedRole = resolvedUser?.roleId
        ? await repositories.roles.getById(resolvedUser.roleId)
        : null;

      setUser(resolvedUser);
      setRole(resolvedRole);

      if (!resolvedUser) {
        setError("No se pudo resolver el usuario de la sesion actual.");
      }
    } catch {
      setUser(null);
      setRole(null);
      setError("No se pudo cargar la sesion actual.");
    } finally {
      setLoading(false);
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
