import { LocationStatus } from "@/core/enums";
import type { StorageLocation } from "@/core/entities";
import type { InventoryRepository } from "@/core/repositories";
import { BackendRequestError, backendFetch } from "@/infrastructure/api/backendClient";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import {
  fetchAllApiPages,
  type ApiLocation,
} from "@/infrastructure/api/repositories/catalogMasterDataApi";
import { assertApiUuid, assertOptionalApiUuid } from "@/infrastructure/api/uuid";

type LocationCreate = Omit<StorageLocation, "id" | "createdAt" | "updatedAt">;
type LocationUpdate = Partial<LocationCreate>;

export class ApiLocationRepository {
  constructor(private readonly eventBus: DataEventBus) {}

  withInventoryDelegate(delegate: InventoryRepository): InventoryRepository {
    const getLocations = this.getLocations.bind(this);
    const createLocation = this.createLocation.bind(this);
    const updateLocation = this.updateLocation.bind(this);
    return new Proxy(delegate, {
      get(target, property) {
        if (property === "getLocations") return getLocations;
        if (property === "createLocation") return createLocation;
        if (property === "updateLocation") return updateLocation;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  async getLocations(branchId?: string) {
    assertOptionalApiUuid(branchId, "branchId");
    const locations = await fetchAllApiPages<ApiLocation>("/catalog/locations", { branchId });
    return locations.map(toLocation);
  }

  async createLocation(input: LocationCreate) {
    assertApiUuid(input.branchId, "branchId");
    assertOptionalApiUuid(input.parentId, "parentId");
    if (!isApiLocationType(input.type)) {
      throw new BackendRequestError("El tipo de ubicación no es compatible con el backend.", 400);
    }
    const location = toLocation(
      await backendFetch<ApiLocation>("/catalog/locations", {
        method: "POST",
        body: {
          branchId: input.branchId,
          parentId: input.parentId || null,
          code: input.code,
          name: input.name,
          type: input.type,
          status: input.status,
        },
      }),
    );
    this.emit(location, "created");
    return location;
  }

  async updateLocation(id: string, input: LocationUpdate) {
    assertApiUuid(id, "locationId");
    const current = await this.getById(id);
    if (!current)
      throw new BackendRequestError("Ubicación no encontrada.", 404, "LOCATION_NOT_FOUND");

    if (input.status === LocationStatus.archived && Object.keys(input).length === 1) {
      await backendFetch<void>(`/catalog/locations/${id}`, { method: "DELETE" });
      const archived = { ...current, status: LocationStatus.archived };
      this.emit(archived, "archived");
      return archived;
    }

    const location = toLocation(
      await backendFetch<ApiLocation>(`/catalog/locations/${id}`, {
        method: "PUT",
        body: {
          name: input.name ?? current.name,
          status: input.status ?? current.status,
        },
      }),
    );
    this.emit(location, "updated");
    return location;
  }

  private async getById(id: string) {
    assertApiUuid(id, "locationId");
    try {
      return toLocation(await backendFetch<ApiLocation>(`/catalog/locations/${id}`));
    } catch (error) {
      if (error instanceof BackendRequestError && error.status === 404) return null;
      throw error;
    }
  }

  private emit(location: StorageLocation, action: "created" | "updated" | "archived") {
    this.eventBus.emit("inventory.changed", {
      entityId: location.id,
      tenantId: location.tenantId,
      branchId: location.branchId,
      action,
      metadata: { entity: "StorageLocation" },
    });
  }
}

function toLocation(location: ApiLocation): StorageLocation {
  return {
    ...location,
    parentId: location.parentId ?? undefined,
  };
}

function isApiLocationType(type: StorageLocation["type"]): type is ApiLocation["type"] {
  return type === "warehouse" || type === "aisle" || type === "shelf" || type === "level";
}
