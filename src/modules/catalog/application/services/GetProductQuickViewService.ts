import type { SupplierProduct } from "@/core/entities";
import { ProductType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import { resolveTenantContext } from "@/modules/catalog/application/services/serviceHelpers";
import type {
  ProductInventorySummaryItem,
  ProductQuickViewModel,
  ProductSupplierSummaryItem,
} from "@/modules/catalog/types/catalog.types";

import {
  REFERENCE_DATA_TTL_MS,
  getReferenceDataCache,
  referenceDataKeys,
} from "@/shared/utils/requestCache";

interface QuickViewBranchContext {
  id: string;
  tenantId: string;
  name: string;
}

export class GetProductQuickViewService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    productId: string,
    branch?: QuickViewBranchContext,
  ): Promise<ProductQuickViewModel | null> {
    const detail = await new GetProductDetailService(this.repositories).execute(productId);
    if (!detail) return null;
    if (this.repositories.productRelationsDataSource === "api") {
      const { permissions } = await resolveTenantContext(this.repositories);
      const tenantId = detail.product.tenantId;
      const canReadInventory = permissions.includes("inventory.stock.read");
      const canReadLocations =
        permissions.includes("catalog.locations.read") ||
        permissions.includes("catalog.locations.manage");
      const canReadSuppliers = permissions.includes("admin.suppliers.manage");
      const canReadUnits = permissions.includes("catalog.units.read");
      const validBranch = branch?.tenantId === tenantId ? branch : undefined;
      const inventoryApplies =
        detail.product.productType === ProductType.physical && detail.product.tracking.stock;

      const canReadStock = Boolean(inventoryApplies && validBranch && canReadInventory);

      const [inventorySettings, stockRead, supplierProducts, suppliers, units] = await Promise.all([
        canReadStock && validBranch
          ? this.repositories.inventory.getProductInventorySettings(productId, validBranch.id)
          : Promise.resolve(null),
        // Degradacion parcial: solo la lectura de existencias se aisla; si falla, el resto del
        // Quick View sigue siendo valido.
        canReadStock && validBranch
          ? this.repositories.inventory
              .getStockBatch({ branchId: validBranch.id, productIds: [productId] })
              .then(
                (result) => ({
                  failed: false,
                  item: result.items.find((stock) => stock.productId === productId) ?? null,
                }),
                () => ({ failed: true, item: null }),
              )
          : Promise.resolve({ failed: false, item: null }),
        canReadSuppliers
          ? this.repositories.supplierProducts
              .getAllByProductForTenant(tenantId, productId)
              .then((items) => items.filter((item) => item.active))
          : Promise.resolve([]),
        canReadSuppliers
          ? this.repositories.suppliers.listByTenant(tenantId)
          : Promise.resolve([]),
        canReadSuppliers && canReadUnits
          ? this.repositories.units.getActiveByTenant(tenantId)
          : Promise.resolve([]),
      ]);
      const defaultLocation =
        inventorySettings?.defaultLocationId && validBranch && canReadLocations
          ? (
              await getReferenceDataCache(this.repositories).getOrLoad(
                referenceDataKeys.locations(tenantId, validBranch.id),
                REFERENCE_DATA_TTL_MS,
                () => this.repositories.inventory.getLocations(validBranch.id),
              )
            ).find((location) => location.id === inventorySettings.defaultLocationId)
          : undefined;
      const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));

      return {
        ...detail,
        inventory: [],
        inventorySettings:
          inventorySettings && validBranch
            ? {
                branchId: validBranch.id,
                branchName: validBranch.name,
                defaultLocationName: defaultLocation?.name,
                minStock: inventorySettings.minStock,
                reorderPoint: inventorySettings.reorderPoint,
              }
            : null,
        inventorySettingsAvailable: canReadStock,
        inventoryStock:
          stockRead.item && validBranch
            ? { branchId: validBranch.id, branchName: validBranch.name, item: stockRead.item }
            : null,
        inventoryStockFailed: stockRead.failed,
        suppliers: supplierProducts
          .map<ProductSupplierSummaryItem | null>((supplierProduct) => {
            const supplier = suppliers.find((item) => item.id === supplierProduct.supplierId);
            if (!supplier) return null;
            return {
              supplier,
              supplierProduct,
              purchaseUnitName: unitNames.get(supplierProduct.purchaseUnitId),
            };
          })
          .filter((item): item is ProductSupplierSummaryItem => Boolean(item)),
        suppliersAvailable: canReadSuppliers,
        promotions: [],
      };
    }
    const tenantId = detail.product.tenantId;

    const [balances, branches, locations, suppliers, units, promotions] = await Promise.all([
      this.repositories.inventory.getBalanceByProduct(productId),
      this.repositories.branches.getActiveByTenant(tenantId),
      this.repositories.inventory.getLocations(),
      this.repositories.suppliers.getActiveByTenant(tenantId),
      this.repositories.units.getActiveByTenant(tenantId),
      this.repositories.promotions.getByProductScoped(tenantId, productId),
    ]);

    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    const locationNames = new Map(
      locations
        .filter((location) => location.tenantId === tenantId)
        .map((location) => [location.id, location.name]),
    );
    const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
    const supplierProducts = await this.getSupplierProducts(tenantId, productId);

    return {
      ...detail,
      inventorySettings: null,
      inventorySettingsAvailable: true,
      inventoryStock: null,
      inventoryStockFailed: false,
      inventory: balances
        .filter((balance) => balance.tenantId === tenantId)
        .map<ProductInventorySummaryItem>((balance) => ({
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
      suppliersAvailable: true,
      promotions,
    };
  }

  private async getSupplierProducts(tenantId: string, productId: string) {
    const suppliers = await this.repositories.suppliers.getActiveByTenant(tenantId);
    const entries = await Promise.all(
      suppliers.map((supplier) => this.repositories.suppliers.getProductsBySupplier(supplier.id)),
    );

    return entries
      .flat()
      .filter(
        (supplierProduct: SupplierProduct) =>
          supplierProduct.tenantId === tenantId && supplierProduct.productId === productId,
      );
  }
}

function getStockStatus(quantity: number, minStock?: number) {
  if (quantity <= 0) return "Sin stock";
  if (typeof minStock === "number" && quantity <= minStock) return "Bajo";
  return "Disponible";
}
