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
      canAccessBranch: (branchId) => canAccessBranch(user, role, branchId),
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

function canAccessBranch(user: User | null, role: Role | null, branchId: string) {
  if (!user || !role) return false;
  if (role.branchScope === "all") return true;
  if (role.branchScope === "selected") return user.allowedBranchIds?.includes(branchId) ?? false;
  return user.branchId === branchId;
}
