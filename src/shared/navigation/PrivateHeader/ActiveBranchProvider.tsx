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
  canAccessBranch?: (branchId: string) => boolean;
  children: ReactNode;
}

const ActiveBranchContext = createContext<ActiveBranchContextValue | null>(null);

export function ActiveBranchProvider({ canAccessBranch, children }: ActiveBranchProviderProps) {
  const repositories = useRepositories();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyBranches = useCallback(
    (activeBranches: Branch[]) => {
      const accessibleBranches = canAccessBranch
        ? activeBranches.filter((branch) => canAccessBranch(branch.id))
        : activeBranches;
      setBranches(accessibleBranches);
      setActiveBranchId((current) => {
        if (current && accessibleBranches.some((branch) => branch.id === current)) return current;
        return accessibleBranches[0]?.id ?? null;
      });
      setLoading(false);
    },
    [canAccessBranch],
  );

  const reloadBranches = useCallback(async () => {
    const activeBranches = await repositories.branches.getActive();
    applyBranches(activeBranches);
  }, [applyBranches, repositories]);

  useEffect(() => {
    let active = true;
    repositories.branches.getActive().then((activeBranches) => {
      if (!active) return;
      applyBranches(activeBranches);
    });

    return () => {
      active = false;
    };
  }, [applyBranches, repositories]);

  useDataEvent("branch.changed", reloadBranches);

  const currentBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) ?? null,
    [activeBranchId, branches],
  );

  const value = useMemo<ActiveBranchContextValue>(
    () => ({
      branches,
      currentBranch,
      loading,
      setActiveBranchId,
    }),
    [branches, currentBranch, loading],
  );

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>;
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext);
  if (!context) throw new Error("useActiveBranch must be used inside ActiveBranchProvider");
  return context;
}
