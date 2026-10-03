import type { Product } from "@/core/entities";
import { LocationStatus, ProductType } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  ProductEditorData,
  ProductMediaEditorValue,
  SupplierProductEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import {
  ensureCanReadProducts,
  resolveTenantContext,
} from "@/modules/catalog/application/services/serviceHelpers";

export class GetProductEditorDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(productId?: string, branchId?: string): Promise<ProductEditorData> {
    const { tenantId, permissions } = await resolveTenantContext(this.repositories);
    ensureCanReadProducts(permissions);
    const apiMode = this.repositories.productRelationsDataSource === "api";
    const hasPermission = (permission: string) => permissions.includes(permission);
    const access: ProductEditorData["access"] = {
      apiMode,
      canUpdateProductRelations: !apiMode || hasPermission("catalog.products.update"),
      canReadConversions: !apiMode || hasPermission("catalog.units.read"),
      canManageConversions: !apiMode || hasPermission("catalog.units.manage"),
      canReadAttributes: !apiMode || hasPermission("catalog.attributes.read"),
      canManageAttributes: !apiMode || hasPermission("catalog.attributes.manage"),
      canManageSuppliers: !apiMode || hasPermission("admin.suppliers.manage"),
      canReadInventorySettings: !apiMode || hasPermission("inventory.stock.read"),
      canReadPromotions: !apiMode || hasPermission("catalog.promotions.read"),
      canManagePromotions: !apiMode || hasPermission("catalog.promotions.manage"),
    };
    const canReadLocations =
      !apiMode ||
      hasPermission("catalog.locations.read") ||
      hasPermission("catalog.locations.manage");

    // Product Detail inicia primero y reutiliza el contexto ya resuelto. Sus lecturas de Product,
    // media, category y unit avanzan en paralelo con los masters independientes del editor.
    const detailLoadPromise = productId
      ? new GetProductDetailService(this.repositories).executeWithMedia(productId, {
          tenantId,
          permissions,
        })
      : Promise.resolve(null);
    const suppliersPromise = access.canManageSuppliers
      ? this.repositories.suppliers.getActiveByTenant(tenantId)
      : Promise.resolve([]);
    const branchDataPromise = (
      branchId
        ? this.repositories.branches.getByIdScoped(tenantId, branchId)
        : Promise.resolve(null)
    ).then(async (branch) => {
      // branchId solo habilita lecturas cuando la sucursal pertenece al tenant activo.
      const tenantBranchId = branch && branch.tenantId === tenantId ? branch.id : undefined;
      const branchLocations =
        tenantBranchId && canReadLocations
          ? await this.repositories.inventory.getLocations(tenantBranchId)
          : [];
      return {
        tenantBranchId,
        branchLocations,
        activeStorageLocations: branchLocations.filter(
          (location) =>
            location.tenantId === tenantId && location.status === LocationStatus.active,
        ),
      };
    });
    const selectKitEligibleProducts = (products: Product[], excludeProductId?: string) =>
      products.filter(
        (product) =>
          product.id !== excludeProductId &&
          product.productType === ProductType.physical &&
          product.tracking.stock,
      );
    const kitEligibleProductsPromise = productId
      ? detailLoadPromise.then((detailLoad) =>
          detailLoad?.detail.product.productType === ProductType.kit
            ? this.repositories.products
                .getByTenant(tenantId)
                .then((products) => selectKitEligibleProducts(products, productId))
            : [],
        )
      : this.repositories.products
          .getByTenant(tenantId)
          .then((products) => selectKitEligibleProducts(products));

    // Las relaciones dependen de un Product scoped valido, pero no de suppliers ni locations.
    // Comienzan apenas termina Product Detail mientras esos masters siguen cargando. Attributes,
    // price tiers, promotions, conversions e inventory settings quedan fuera y se hidratan al
    // abrir sus pestanas.
    const relationsPromise = detailLoadPromise.then(async (detailLoad) => {
      if (!productId || !detailLoad) return null;
      const { detail } = detailLoad;
      const supplierProductsPromise = (
        detail.product.productType !== ProductType.kit && access.canManageSuppliers
          ? this.repositories.supplierProducts
              .getAllByProductForTenant(tenantId, productId)
              .then((items) => items.filter((item) => item.active))
          : Promise.resolve([])
      ).then((supplierProducts) =>
        supplierProducts.map(
          (supplierProduct): SupplierProductEditorValue => ({
            id: supplierProduct.id,
            supplierId: supplierProduct.supplierId,
            supplierSku: supplierProduct.supplierSku,
            purchaseUnitId: supplierProduct.purchaseUnitId,
            purchaseToBaseFactor: supplierProduct.purchaseToBaseFactor,
            lastCost: supplierProduct.lastCost,
            leadTimeDays: supplierProduct.leadTimeDays,
            minimumOrderQuantity: supplierProduct.minimumOrderQuantity,
            preferred: supplierProduct.preferred,
            active: supplierProduct.active,
            costTiers: undefined,
          }),
        ),
      );
      const [supplierProducts, kitComponents] = await Promise.all([
        supplierProductsPromise,
        detail.product.productType === ProductType.kit
          ? this.repositories.productKitComponents.getByKitProduct(productId)
          : Promise.resolve([]),
      ]);
      return {
        supplierProducts,
        kitComponents,
      };
    });

    const [
      detailLoad,
      suppliers,
      branchData,
      kitEligibleProducts,
      relations,
    ] = await Promise.all([
      detailLoadPromise,
      suppliersPromise,
      branchDataPromise,
      kitEligibleProductsPromise,
      relationsPromise,
    ]);

    if (!detailLoad || !relations) {
      return {
        access,
        detail: null,
        unitConversion: undefined,
        unitConversions: undefined,
        inventorySettings: undefined,
        storageLocations: branchData.activeStorageLocations,
        branchLocations: branchData.branchLocations,
        currentDefaultLocation: undefined,
        attributeDefinitions: undefined,
        attributes: undefined,
        salesPriceTiers: undefined,
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: undefined,
        kitComponents: [],
        kitEligibleProducts,
      };
    }

    const { detail, media } = detailLoad;
    const editableMedia: ProductMediaEditorValue[] = media.map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      source: item.source,
      alt: item.alt,
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
    }));

    return {
      access,
      detail,
      unitConversion: undefined,
      unitConversions: undefined,
      inventorySettings: undefined,
      storageLocations: branchData.activeStorageLocations,
      branchLocations: branchData.branchLocations,
      currentDefaultLocation: undefined,
      attributeDefinitions: undefined,
      attributes: undefined,
      salesPriceTiers: undefined,
      suppliers,
      supplierProducts: relations.supplierProducts,
      media: editableMedia,
      promotionCount: undefined,
      kitComponents: relations.kitComponents.map((component) => ({
        componentProductId: component.componentProductId,
        quantityPerKit: component.quantityPerKit,
      })),
      kitEligibleProducts,
    };
  }
}
