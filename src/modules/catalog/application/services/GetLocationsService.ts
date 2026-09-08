import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { LocationListItem } from "@/modules/catalog/application/dto/LocationEditorDto";

export class GetLocationsService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(branchId?: string): Promise<LocationListItem[]> {
    const [locations, products] = await Promise.all([
      this.repositories.inventory.getLocations(branchId),
      this.repositories.products.getAll(),
    ]);
    const productCounts = branchId
      ? await countProductsByDefaultLocation(this.repositories, products.map((product) => product.id), branchId)
      : new Map<string, number>();

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

async function countProductsByDefaultLocation(
  repositories: RepositoryRegistry,
  productIds: string[],
  branchId: string,
) {
  const productIdsByLocation = new Map<string, Set<string>>();

  const settings = await Promise.all(
    productIds.map((productId) => repositories.inventory.getProductInventorySettings(productId, branchId)),
  );

  settings.forEach((setting) => {
    if (!setting?.defaultLocationId) return;
    const locationProductIds =
      productIdsByLocation.get(setting.defaultLocationId) ?? new Set<string>();
    locationProductIds.add(setting.productId);
    productIdsByLocation.set(setting.defaultLocationId, locationProductIds);
  });

  return new Map(
    [...productIdsByLocation.entries()].map(([locationId, locationProductIds]) => [
      locationId,
      locationProductIds.size,
    ]),
  );
}

function sortLocations(left: LocationListItem, right: LocationListItem) {
  return left.name.localeCompare(right.name);
}
