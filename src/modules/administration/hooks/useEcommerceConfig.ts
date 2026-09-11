"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Branch } from "@/core/entities";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  EcommerceConfigDto,
  EcommerceConfigInputDto,
} from "@/modules/administration/application/dto/EcommerceConfigDto";
import { GetEcommerceConfigService } from "@/modules/administration/application/services/GetEcommerceConfigService";
import { SaveEcommerceConfigService } from "@/modules/administration/application/services/SaveEcommerceConfigService";
import { cleanError } from "@/modules/administration/application/services/serviceHelpers";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

export interface EcommerceBranchOption {
  id: string;
  name: string;
}

function toBranchOptions(branches: Branch[], tenantId: string): EcommerceBranchOption[] {
  return branches
    .filter((branch) => branch.tenantId === tenantId)
    .map((branch) => ({ id: branch.id, name: branch.name }));
}

export function useEcommerceConfig() {
  const repositories = useRepositories();
  const { user, permissions, hasPermission, loading: sessionLoading } = useCurrentSession();
  const tenantId = user?.tenantId ?? null;
  const actorUserId = user?.id ?? null;
  const canManage = hasPermission("admin.ecommerce_config.manage");
  const getService = useMemo(() => new GetEcommerceConfigService(repositories), [repositories]);
  const saveService = useMemo(() => new SaveEcommerceConfigService(repositories), [repositories]);
  const [config, setConfig] = useState<EcommerceConfigDto | null>(null);
  const [branchOptions, setBranchOptions] = useState<EcommerceBranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<EcommerceConfigDto | null> => {
    if (sessionLoading) return null;
    if (!tenantId || !actorUserId) {
      setConfig(null);
      setBranchOptions([]);
      setError("No se pudo resolver el negocio activo.");
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextConfig, branches] = await Promise.all([
        getService.execute(tenantId, actorUserId, permissions),
        repositories.branches.getActive(),
      ]);
      setConfig(nextConfig);
      setBranchOptions(toBranchOptions(branches, tenantId));
      return nextConfig;
    } catch (caughtError) {
      setConfig(null);
      setBranchOptions([]);
      setError(cleanError(caughtError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [actorUserId, getService, permissions, repositories, sessionLoading, tenantId]);

  useDataEvent("business-config.changed", reload);

  useEffect(() => {
    let active = true;

    if (!sessionLoading && (!tenantId || !actorUserId)) {
      window.queueMicrotask(() => {
        if (!active) return;
        setConfig(null);
        setBranchOptions([]);
        setError("No se pudo resolver el negocio activo.");
        setLoading(false);
      });
    } else if (tenantId && actorUserId) {
      Promise.all([
        getService.execute(tenantId, actorUserId, permissions),
        repositories.branches.getActive(),
      ])
        .then(([nextConfig, branches]) => {
          if (!active) return;
          setConfig(nextConfig);
          setBranchOptions(toBranchOptions(branches, tenantId));
          setError(null);
        })
        .catch((caughtError: unknown) => {
          if (!active) return;
          setConfig(null);
          setBranchOptions([]);
          setError(cleanError(caughtError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [actorUserId, getService, permissions, repositories, sessionLoading, tenantId]);

  const save = useCallback(
    async (dto: EcommerceConfigInputDto): Promise<EcommerceConfigDto> => {
      if (!tenantId || !actorUserId) {
        const message = "No se pudo resolver la sesión actual.";
        setError(message);
        throw new Error(message);
      }

      setSaving(true);
      setError(null);
      try {
        const savedConfig = await saveService.execute(tenantId, dto, permissions, actorUserId);
        setConfig(savedConfig);
        return savedConfig;
      } catch (caughtError) {
        const message = cleanError(caughtError);
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [actorUserId, permissions, saveService, tenantId],
  );

  return {
    loading: loading || sessionLoading,
    saving,
    error,
    config,
    branchOptions,
    canManage,
    save,
    reload,
  };
}
