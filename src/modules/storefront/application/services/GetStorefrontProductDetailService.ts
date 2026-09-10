import { BranchType, ProductType } from "@/core/enums";
import {
  getCanonicalKitAvailability,
  getCanonicalProductAvailability,
} from "@/core/inventory/canonicalAvailability";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type { StorefrontProductDetailDto } from "@/modules/storefront/application/dto/StorefrontProductDetailDto";

export class GetStorefrontProductDetailService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(tenantId: string, productId: string): Promise<StorefrontProductDetailDto | null> {
    const [products, allProducts, branches, balances, locations, lots, serials] = await Promise.all([
      this.repositories.products.getPublishedForEcommerce(tenantId),
      this.repositories.products.getAll(),
      this.repositories.branches.getActive(),
      this.repositories.inventory.getBalances(),
      this.repositories.inventory.getLocations(),
      this.repositories.inventory.getLots(),
      this.repositories.inventory.getSerialNumbers(),
    ]);
    const product = products.find((item) => item.id === productId);
    if (!product) return null;

    if (product.productType === ProductType.service) return { product };

    const kitComponents =
      product.productType === ProductType.kit
        ? await this.repositories.productKitComponents.getByKitProduct(product.id)
        : [];
    const productsById = new Map(
      allProducts.filter((item) => item.tenantId === tenantId).map((item) => [item.id, item]),
    );
    const at = new Date().toISOString();

    const availability = branches
      .filter((branch) => branch.tenantId === tenantId && branch.type !== BranchType.warehouse)
      .map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        address: branch.address,
        available: getAvailability({
          product,
          kitComponents,
          productsById,
          tenantId,
          branchId: branch.id,
          balances,
          lots,
          serials,
          locations,
          at,
        }) > 0,
      }));

    return { product, availability };
  }
}

function getAvailability({
  product,
  kitComponents,
  productsById,
  tenantId,
  branchId,
  balances,
  lots,
  serials,
  locations,
  at,
}: {
  product: StorefrontProductDetailDto["product"];
  kitComponents: Array<{ componentProductId: string; quantityPerKit: number }>;
  productsById: ReadonlyMap<string, StorefrontProductDetailDto["product"]>;
  tenantId: string;
  branchId: string;
  balances: Parameters<typeof getCanonicalProductAvailability>[0]["balances"];
  lots: Parameters<typeof getCanonicalProductAvailability>[0]["lots"];
  serials: Parameters<typeof getCanonicalProductAvailability>[0]["serials"];
  locations: Parameters<typeof getCanonicalProductAvailability>[0]["locations"];
  at: string;
}): number {
  if (product.productType === ProductType.physical) {
    return getCanonicalProductAvailability({
      product,
      tenantId,
      branchId,
      balances,
      lots,
      serials,
      locations,
      at,
    });
  }

  const componentAvailability = new Map(
    kitComponents.map((component) => {
      const componentProduct = productsById.get(component.componentProductId);
      const available = componentProduct
        ? getCanonicalProductAvailability({
            product: componentProduct,
            tenantId,
            branchId,
            balances,
            lots,
            serials,
            locations,
            at,
          })
        : 0;
      return [component.componentProductId, available];
    }),
  );

  return getCanonicalKitAvailability({ components: kitComponents, componentAvailability });
}
