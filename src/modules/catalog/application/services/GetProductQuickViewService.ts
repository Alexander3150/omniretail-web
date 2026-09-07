import type { SupplierProduct } from "@/core/entities";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import type {
  ProductInventorySummaryItem,
  ProductQuickViewModel,
  ProductSupplierSummaryItem,
} from "@/modules/catalog/types/catalog.types";

export class GetProductQuickViewService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId: string): Promise<ProductQuickViewModel | null> {
    const detail = await new GetProductDetailService(this.repositories).execute(productId);
    if (!detail) return null;

    const [balances, branches, locations, suppliers, units, promotions] = await Promise.all([
      this.repositories.inventory.getBalanceByProduct(productId),
      this.repositories.branches.getActive(),
      this.repositories.inventory.getLocations(),
      this.repositories.suppliers.getActive(),
      this.repositories.units.getActive(),
      this.repositories.promotions.getByProduct(productId),
    ]);

    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    const locationNames = new Map(locations.map((location) => [location.id, location.name]));
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    const supplierProducts = await this.getSupplierProducts(productId);

    return {
      ...detail,
      inventory: balances.map<ProductInventorySummaryItem>((balance) => ({
        balance,
        branchName: branchNames.get(balance.branchId) ?? "Sucursal no disponible",
        locationName: balance.locationId ? locationNames.get(balance.locationId) : undefined,
        stockStatus: getStockStatus(balance.quantity, balance.minStock),
      })),
      suppliers: supplierProducts
        .map<ProductSupplierSummaryItem | null>((supplierProduct) => {
          const supplier = suppliers.find((item) => item.id === supplierProduct.supplierId);
          if (!supplier) return null;
          return {
            supplier,
            supplierProduct,
            purchaseUnitName: supplierProduct.purchaseUnitId
              ? unitNames.get(supplierProduct.purchaseUnitId)
              : undefined,
          };
        })
        .filter((item): item is ProductSupplierSummaryItem => Boolean(item)),
      promotions,
    };
  }

  private async getSupplierProducts(productId: string) {
    const suppliers = await this.repositories.suppliers.getActive();
    const entries = await Promise.all(
      suppliers.map((supplier) => this.repositories.suppliers.getProductsBySupplier(supplier.id)),
    );

    return entries
      .flat()
      .filter((supplierProduct: SupplierProduct) => supplierProduct.productId === productId);
  }
}

function getStockStatus(quantity: number, minStock?: number) {
  if (quantity <= 0) return "Sin stock";
  if (typeof minStock === "number" && quantity <= minStock) return "Bajo";
  return "Disponible";
}
