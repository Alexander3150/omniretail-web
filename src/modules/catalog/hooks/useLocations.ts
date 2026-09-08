"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocationStatus } from "@/core/enums";
import { useRepositories } from "@/infrastructure/providers/RepositoryProvider";
import { useDataEvent } from "@/shared/hooks/useDataEvent";
import { useActiveBranch } from "@/shared/navigation/PrivateHeader/ActiveBranchProvider";
import type {
  LocationEditorDto,
  LocationListItem,
} from "@/modules/catalog/application/dto/LocationEditorDto";
import { GetLocationsService } from "@/modules/catalog/application/services/GetLocationsService";
import { SaveLocationService } from "@/modules/catalog/application/services/SaveLocationService";
import { cleanError } from "@/modules/catalog/application/services/serviceHelpers";

export type LocationStatusFilter = LocationStatus.active | LocationStatus.archived;

const DEFAULT_PAGE_SIZE = 10;

export function useLocations() {
  const repositories = useRepositories();
  const { currentBranch, loading: branchLoading } = useActiveBranch();
  const getService = useMemo(() => new GetLocationsService(repositories), [repositories]);
  const saveService = useMemo(() => new SaveLocationService(repositories), [repositories]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [search, setSearchState] = useState("");
  const [status, setStatusState] = useState<LocationStatusFilter>(LocationStatus.active);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!currentBranch) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLocations(await getService.execute(currentBranch.id));
    } catch {
      setError("No se pudieron cargar las ubicaciones.");
    } finally {
      setLoading(false);
    }
  }, [currentBranch, getService]);

  useDataEvent("inventory.changed", reload);
  useDataEvent("stock.changed", reload);
  useDataEvent("branch.changed", reload);

  useEffect(() => {
    if (!currentBranch) {
      return;
    }
    let active = true;
    getService
      .execute(currentBranch.id)
      .then((nextLocations) => {
        if (!active) return;
        setLocations(nextLocations);
        setError(null);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar las ubicaciones.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentBranch, getService]);

  const branchLocations = useMemo(
    () =>
      currentBranch
        ? locations.filter((location) => location.branchId === currentBranch.id)
        : [],
    [currentBranch, locations],
  );
  const filteredLocations = useMemo(
    () => filterLocations(branchLocations, search, status),
    [branchLocations, search, status],
  );
  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLocations = filteredLocations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setStatus = useCallback((value: LocationStatusFilter) => {
    setStatusState(value);
    setPage(1);
  }, []);

  const setPageSize = useCallback((value: number) => {
    setPageSizeState(value);
    setPage(1);
  }, []);

  async function runMutation(action: () => Promise<LocationListItem | null>) {
    setBusy(true);
    setError(null);
    try {
      const location = await action();
      await reload();
      return location;
    } catch (caughtError) {
      const message = cleanError(caughtError);
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  return {
    loading: branchLoading || loading,
    busy,
    error,
    locations: branchLocations,
    currentBranch,
    filteredLocations,
    paginatedLocations,
    search,
    status,
    page: currentPage,
    pageSize,
    totalPages,
    setSearch,
    setStatus,
    setPage,
    setPageSize,
    reload,
    create: (dto: LocationEditorDto) =>
      runMutation(async () => {
        if (!currentBranch) throw new Error("No hay una sucursal activa.");
        const created = await saveService.create({ ...dto, branchId: currentBranch.id, parentId: "" });
        return getService.execute(currentBranch.id).then(
          (items) => items.find((item) => item.id === created.id) ?? null,
        );
      }),
    update: (locationId: string, dto: LocationEditorDto) =>
      runMutation(async () => {
        const updated = await saveService.update(locationId, dto);
        return getService.execute(dto.branchId).then(
          (items) => items.find((item) => item.id === updated.id) ?? null,
        );
      }),
    archive: (locationId: string) => runMutation(async () => {
      await saveService.archive(locationId);
      return null;
    }),
    restore: (locationId: string) => runMutation(async () => {
      await saveService.restore(locationId);
      return null;
    }),
  };
}

function filterLocations(
  locations: LocationListItem[],
  search: string,
  status: LocationStatusFilter,
) {
  const query = search.trim().toLowerCase();

  return locations.filter((location) => {
    const matchesStatus = location.status === status;
    const matchesSearch =
      !query ||
      [location.name, location.code, location.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });
}
