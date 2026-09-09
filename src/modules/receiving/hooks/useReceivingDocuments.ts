"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceivingDocumentsService } from "@/modules/receiving/application/services/ReceivingDocumentsService";
import type {
  ReceivingReadModel,
  ReceivingStatus,
  ReceivingTab,
} from "@/modules/receiving/application/dto/ReceivingDocumentsDto";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";

interface ReceivingFilters {
  search: string;
  status: ReceivingStatus | "all";
  tab: ReceivingTab;
}

const DEFAULT_FILTERS: ReceivingFilters = {
  search: "",
  status: "all",
  tab: "orders",
};

const EMPTY_DATA: ReceivingReadModel = {
  documents: [],
  incidents: [],
  incidentTypes: [],
};

export function useReceivingDocuments() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const activeBranchId = currentBranch?.id;
  const tenantId = currentBranch?.tenantId;
  const service = useMemo(() => new ReceivingDocumentsService(repositories), [repositories]);
  const [data, setData] = useState<ReceivingReadModel>(EMPTY_DATA);
  const [filters, setFilters] = useState<ReceivingFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.execute(activeBranchId));
    } catch {
      setError("No se pudieron cargar las recepciones.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, service]);

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

  useDataEvent("purchase-order.changed", reload);
  useDataEvent("inventory-transfer.changed", reload);
  useDataEvent("receipt.changed", reload);
  useDataEvent("incident-type.changed", reload);
  useDataEvent("supplier.changed", reload);
  useDataEvent("branch.changed", reload);
  useDataEvent("product.changed", reload);

  const filteredDocuments = useMemo(() => {
    const search = normalize(filters.search);
    return data.documents.filter((document) => {
      const matchesSearch = !search || document.searchText.includes(search);
      const matchesStatus = filters.status === "all" || document.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [data.documents, filters.search, filters.status]);

  const updateFilters = useCallback((patch: Partial<ReceivingFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const createIncidentType = useCallback(
    async (name: string) => {
      if (!tenantId) throw new Error("No hay una sucursal activa.");
      await service.createIncidentType({ tenantId, name });
      await reload();
    },
    [reload, service, tenantId],
  );

  const archiveIncidentType = useCallback(
    async (id: string) => {
      await service.archiveIncidentType(id);
      await reload();
    },
    [reload, service],
  );

  const deleteIncidentType = useCallback(
    async (id: string) => {
      await service.deleteIncidentType(id);
      await reload();
    },
    [reload, service],
  );

  return {
    data,
    filters,
    filteredDocuments,
    currentBranch,
    loading: branchLoading || loading,
    error,
    updateFilters,
    createIncidentType,
    archiveIncidentType,
    deleteIncidentType,
    reload,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
