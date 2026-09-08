import type { InventoryBalance } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { LocationListItem } from "@/modules/catalog/application/dto/LocationEditorDto";

export class GetLocationsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(branchId?: string): Promise<LocationListItem[]> {
    const [locations, balances] = await Promise.all([
      this.repositories.inventory.getLocations(branchId),
      this.repositories.inventory.getBalances(),
    ]);
    const productCounts = countProductsByLocation(balances);

    return locations
      .map((location) => ({
        id: location.id,
        tenantId: location.tenantId,
        branchId: location.branchId,
        parentId: location.parentId,
        code: location.code,
        name: location.name,
        type: location.type,
        description: location.description,
        status: location.status,
        productCount: productCounts.get(location.id) ?? 0,
      }))
      .sort(sortLocations);
  }
}

function countProductsByLocation(balances: InventoryBalance[]) {
  const productIdsByLocation = new Map<string, Set<string>>();

  balances.forEach((balance) => {
    if (!balance.locationId) return;
    const productIds = productIdsByLocation.get(balance.locationId) ?? new Set<string>();
    productIds.add(balance.productId);
    productIdsByLocation.set(balance.locationId, productIds);
  });

  return new Map(
    [...productIdsByLocation.entries()].map(([locationId, productIds]) => [
      locationId,
      productIds.size,
    ]),
  );
}

function sortLocations(left: LocationListItem, right: LocationListItem) {
  return left.name.localeCompare(right.name);
}
