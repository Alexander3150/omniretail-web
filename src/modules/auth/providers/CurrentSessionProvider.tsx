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
import { demoSessionConfig } from "@/config/demo-session";
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
      const demoUser = await repositories.users.getByEmail(demoSessionConfig.cashierEmail);
      const demoRole = demoUser?.roleId ? await repositories.roles.getById(demoUser.roleId) : null;
      setUser(demoUser);
      setRole(demoRole);
      if (!demoUser || !demoRole) {
        setError("No se pudo resolver la sesion demo.");
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
      isDemo: true,
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
