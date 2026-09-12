"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type {
  CustomerCreateInputDto,
  CustomerDto,
  CustomerUpdateInputDto,
} from "@/modules/administration/application/dto/CustomerDto";
import { ArchiveCustomerService } from "@/modules/administration/application/services/ArchiveCustomerService";
import { CreateCustomerService } from "@/modules/administration/application/services/CreateCustomerService";
import { GetCustomersService } from "@/modules/administration/application/services/GetCustomersService";
import { cleanError } from "@/modules/administration/application/services/serviceHelpers";
import { UpdateCustomerService } from "@/modules/administration/application/services/UpdateCustomerService";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

export function useCustomers() {
  const repositories = useRepositories();
  const { user, permissions, hasPermission, loading: sessionLoading } = useCurrentSession();
  const tenantId = user?.tenantId ?? null;
  const actorUserId = user?.id ?? null;
  const canManage = hasPermission("admin.customers.manage");
  const canRead = canManage || hasPermission("admin.customers.read");
  const getService = useMemo(() => new GetCustomersService(repositories), [repositories]);
  const createService = useMemo(() => new CreateCustomerService(repositories), [repositories]);
  const updateService = useMemo(() => new UpdateCustomerService(repositories), [repositories]);
  const archiveService = useMemo(() => new ArchiveCustomerService(repositories), [repositories]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<CustomerDto[]> => {
    if (sessionLoading) return [];
    if (!tenantId) {
      setCustomers([]);
      setError("No se pudo resolver el negocio activo.");
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const nextCustomers = await getService.execute(tenantId, permissions);
      setCustomers(nextCustomers);
      return nextCustomers;
    } catch (caughtError) {
      setCustomers([]);
      setError(cleanError(caughtError));
      return [];
    } finally {
      setLoading(false);
    }
  }, [getService, permissions, sessionLoading, tenantId]);

  useDataEvent("customer.changed", reload);

  useEffect(() => {
    let active = true;

    if (!sessionLoading && !tenantId) {
      window.queueMicrotask(() => {
        if (!active) return;
        setCustomers([]);
        setError("No se pudo resolver el negocio activo.");
        setLoading(false);
      });
    } else if (tenantId) {
      getService
        .execute(tenantId, permissions)
        .then((nextCustomers) => {
          if (!active) return;
          setCustomers(nextCustomers);
          setError(null);
        })
        .catch((caughtError: unknown) => {
          if (!active) return;
          setCustomers([]);
          setError(cleanError(caughtError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [getService, permissions, sessionLoading, tenantId]);

  const runMutation = useCallback(
    async (action: (tenantId: string, actorUserId: string) => Promise<CustomerDto>) => {
      if (!tenantId || !actorUserId) {
        const message = "No se pudo resolver la sesión actual.";
        setError(message);
        throw new Error(message);
      }

      setBusy(true);
      setError(null);
      try {
        return await action(tenantId, actorUserId);
      } catch (caughtError) {
        const message = cleanError(caughtError);
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [actorUserId, tenantId],
  );

  const create = useCallback(
    (dto: CustomerCreateInputDto) =>
      runMutation((currentTenantId, currentActorUserId) =>
        createService.execute(currentTenantId, dto, permissions, currentActorUserId),
      ),
    [createService, permissions, runMutation],
  );

  const update = useCallback(
    (customerId: string, dto: CustomerUpdateInputDto) =>
      runMutation((currentTenantId, currentActorUserId) =>
        updateService.execute(currentTenantId, customerId, dto, permissions, currentActorUserId),
      ),
    [permissions, runMutation, updateService],
  );

  const archive = useCallback(
    (customerId: string) =>
      runMutation((currentTenantId, currentActorUserId) =>
        archiveService.execute(currentTenantId, customerId, permissions, currentActorUserId),
      ),
    [archiveService, permissions, runMutation],
  );

  return {
    loading: loading || sessionLoading,
    busy,
    error,
    customers,
    canRead,
    canManage,
    create,
    update,
    archive,
    reload,
  };
}
