import { BranchType } from "@/core/enums";
import { getBranchAvailableQuantity } from "@/core/inventory/stockAvailability";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontProductDetailDto } from "@/modules/storefront/application/dto/StorefrontProductDetailDto";

export class GetStorefrontProductDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, productId: string): Promise<StorefrontProductDetailDto | null> {
    const [products, branches, balances, locations] = await Promise.all([
      this.repositories.products.getPublishedForEcommerce(tenantId),
      this.repositories.branches.getActive(),
      this.repositories.inventory.getBalanceByProduct(productId),
      this.repositories.inventory.getLocations(),
    ]);
    const product = products.find((item) => item.id === productId);
    if (!product) return null;

    const availability = branches
      .filter((branch) => branch.tenantId === tenantId && branch.type !== BranchType.warehouse)
      .map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        address: branch.address,
        available:
          getBranchAvailableQuantity({
            tenantId,
            branchId: branch.id,
            productId,
            balances,
            locations,
          }) > 0,
      }));

    return { product, availability };
  }
}
