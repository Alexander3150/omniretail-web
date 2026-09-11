"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import type { DataEventPayload } from "@/core/types/events.types";
import type {
  AuditLogDto,
  AuditLogFilter,
} from "@/modules/administration/application/dto/AuditLogDto";
import { GetAuditLogsService } from "@/modules/administration/application/services/GetAuditLogsService";
import { cleanError } from "@/modules/administration/application/services/serviceHelpers";
import { useCurrentSession } from "@/modules/auth/hooks/useCurrentSession";
import { useDataEvent } from "@/shared/hooks/useDataEvent";

const EMPTY_FILTER: AuditLogFilter = {};

export function useAuditLogs() {
  const repositories = useRepositories();
  const { user, permissions, hasPermission, loading: sessionLoading } = useCurrentSession();
  const tenantId = user?.tenantId ?? null;
  const canRead = hasPermission("admin.audit.read");
  const getService = useMemo(() => new GetAuditLogsService(repositories), [repositories]);
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [actorNames, setActorNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [filter, setFilter] = useState<AuditLogFilter>(EMPTY_FILTER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<AuditLogDto[]> => {
    if (sessionLoading) return [];
    if (!tenantId) {
      setLogs([]);
      setActorNames(new Map());
      setError("No se pudo resolver el negocio activo.");
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const [nextLogs, users] = await Promise.all([
        getService.execute(tenantId, permissions),
        repositories.users.getAll(),
      ]);
      setLogs(nextLogs);
      setActorNames(
        new Map(
          users
            .filter((candidate) => candidate.tenantId === tenantId)
            .map((candidate) => [candidate.id, candidate.name]),
        ),
      );
      return nextLogs;
    } catch (caughtError) {
      setLogs([]);
      setActorNames(new Map());
      setError(cleanError(caughtError));
      return [];
    } finally {
      setLoading(false);
    }
  }, [getService, permissions, repositories, sessionLoading, tenantId]);

  const handleAuditChanged = useCallback(
    (event: DataEventPayload) => {
      if (!tenantId || event.tenantId !== tenantId) return;
      void reload();
    },
    [reload, tenantId],
  );

  useDataEvent("audit.changed", handleAuditChanged);

  useEffect(() => {
    let active = true;

    if (!sessionLoading && !tenantId) {
      window.queueMicrotask(() => {
        if (!active) return;
        setLogs([]);
        setActorNames(new Map());
        setError("No se pudo resolver el negocio activo.");
        setLoading(false);
      });
    } else if (tenantId) {
      Promise.all([getService.execute(tenantId, permissions), repositories.users.getAll()])
        .then(([nextLogs, users]) => {
          if (!active) return;
          setLogs(nextLogs);
          setActorNames(
            new Map(
              users
                .filter((candidate) => candidate.tenantId === tenantId)
                .map((candidate) => [candidate.id, candidate.name]),
            ),
          );
          setError(null);
        })
        .catch((caughtError: unknown) => {
          if (!active) return;
          setLogs([]);
          setActorNames(new Map());
          setError(cleanError(caughtError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [getService, permissions, repositories, sessionLoading, tenantId]);

  const filteredLogs = useMemo(() => filterAuditLogs(logs, filter), [filter, logs]);
  const resetFilter = useCallback(() => setFilter(EMPTY_FILTER), []);

  return {
    loading: loading || sessionLoading,
    error,
    logs,
    filteredLogs,
    actorNames,
    filter,
    setFilter,
    resetFilter,
    canRead,
    reload,
  };
}

function filterAuditLogs(logs: AuditLogDto[], filter: AuditLogFilter): AuditLogDto[] {
  const query = filter.search?.trim().toLowerCase();

  return logs.filter((log) => {
    const createdDate = log.createdAt.slice(0, 10);
    const matchesSearch =
      !query ||
      [
        log.action,
        log.entityType,
        log.entityId,
        log.actorUserId,
        stringifyMetadata(log.metadata),
      ].some((value) => (value ?? "").toLowerCase().includes(query));

    return (
      matchesSearch &&
      (!filter.action || log.action === filter.action) &&
      (!filter.entityType || log.entityType === filter.entityType) &&
      (!filter.actorUserId || log.actorUserId === filter.actorUserId) &&
      (!filter.from || createdDate >= filter.from) &&
      (!filter.to || createdDate <= filter.to)
    );
  });
}

function stringifyMetadata(metadata: AuditLogDto["metadata"]): string {
  if (!metadata) return "";

  try {
    return JSON.stringify(metadata);
  } catch {
    return "";
  }
}
