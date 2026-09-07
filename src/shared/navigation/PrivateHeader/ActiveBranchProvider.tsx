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

const ActiveBranchContext = createContext<ActiveBranchContextValue | null>(null);

export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const repositories = useRepositories();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadBranches = useCallback(async () => {
    const activeBranches = await repositories.branches.getActive();
    setBranches(activeBranches);
    setActiveBranchId((current) => {
      if (current && activeBranches.some((branch) => branch.id === current)) return current;
      return activeBranches[0]?.id ?? null;
    });
    setLoading(false);
  }, [repositories]);

  useEffect(() => {
    let active = true;
    repositories.branches.getActive().then((activeBranches) => {
      if (!active) return;
      setBranches(activeBranches);
      setActiveBranchId((current) => {
        if (current && activeBranches.some((branch) => branch.id === current)) return current;
        return activeBranches[0]?.id ?? null;
      });
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [repositories]);

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
