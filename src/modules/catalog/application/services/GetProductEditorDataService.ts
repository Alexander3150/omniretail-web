import type { Product } from "@/core/entities";
import { LocationStatus, ProductType, PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import type {
  ProductAttributeEditorValue,
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
    const attributeDefinitionsPromise = (
      access.canReadAttributes
        ? this.repositories.attributes.getDefinitions()
        : Promise.resolve([])
    ).then((definitions) =>
      // getDefinitions() sigue siendo global legacy; el DTO solo recibe definiciones del tenant.
      definitions.filter(
        (definition) => definition.tenantId === undefined || definition.tenantId === tenantId,
      ),
    );
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

    // Las relaciones dependen de un Product scoped valido, pero no de definitions, suppliers ni
    // locations. Comienzan apenas termina Product Detail mientras esos masters siguen cargando.
    const relationsPromise = detailLoadPromise.then(async (detailLoad) => {
      if (!productId || !detailLoad) return null;
      const { detail } = detailLoad;
      const supplierProductsPromise = (
        detail.product.productType !== ProductType.kit && access.canManageSuppliers
          ? this.repositories.supplierProducts.getByProductForTenant(tenantId, productId)
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
      const inventorySettingsPromise = branchDataPromise.then(({ tenantBranchId }) =>
        detail.product.productType === ProductType.physical &&
        detail.product.tracking.stock &&
        tenantBranchId &&
        access.canReadInventorySettings
          ? this.repositories.inventory.getProductInventorySettings(productId, tenantBranchId)
          : null,
      );

      const [
        conversions,
        attributeValues,
        salesPriceTiers,
        supplierProducts,
        promotions,
        inventorySettings,
        kitComponents,
      ] = await Promise.all([
        detail.product.productType !== ProductType.kit && access.canReadConversions
          ? this.repositories.units.getConversionsByProductScoped(tenantId, productId)
          : Promise.resolve([]),
        this.repositories.attributes.getValuesByProduct(productId),
        this.repositories.productSalesPriceTiers.getByProduct(productId),
        supplierProductsPromise,
        access.canReadPromotions
          ? this.repositories.promotions.getByProductScoped(tenantId, productId)
          : Promise.resolve([]),
        inventorySettingsPromise,
        detail.product.productType === ProductType.kit
          ? this.repositories.productKitComponents.getByKitProduct(productId)
          : Promise.resolve([]),
      ]);
      return {
        conversions,
        attributeValues,
        salesPriceTiers,
        supplierProducts,
        promotions,
        inventorySettings,
        kitComponents,
      };
    });

    const [
      detailLoad,
      attributeDefinitions,
      suppliers,
      branchData,
      kitEligibleProducts,
      relations,
    ] = await Promise.all([
      detailLoadPromise,
      attributeDefinitionsPromise,
      suppliersPromise,
      branchDataPromise,
      kitEligibleProductsPromise,
      relationsPromise,
    ]);

    if (!detailLoad || !relations) {
      return {
        access,
        detail: null,
        unitConversion: null,
        unitConversions: [],
        inventorySettings: null,
        storageLocations: branchData.activeStorageLocations,
        currentDefaultLocation: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
        kitComponents: [],
        kitEligibleProducts,
      };
    }

    const { detail, media } = detailLoad;
    const currentDefaultLocation = relations.inventorySettings?.defaultLocationId
      ? (branchData.branchLocations.find(
          (location) => location.id === relations.inventorySettings?.defaultLocationId,
        ) ?? null)
      : null;
    const saleUnitId = detail.product.saleUnitId ?? detail.product.baseUnitId;
    const unitConversion =
      relations.conversions.find(
        (conversion) =>
          conversion.fromUnitId === detail.product.baseUnitId && conversion.toUnitId === saleUnitId,
      ) ??
      relations.conversions.find(
        (conversion) =>
          conversion.fromUnitId === saleUnitId && conversion.toUnitId === detail.product.baseUnitId,
      ) ??
      null;
    const editableAttributes: ProductAttributeEditorValue[] = relations.attributeValues.map(
      (value) => {
        const definition = attributeDefinitions.find(
          (item) => item.id === value.attributeDefinitionId,
        );
        return {
          attributeDefinitionId: value.attributeDefinitionId,
          name: definition?.name ?? value.name ?? "Atributo",
          value: String(value.value),
        };
      },
    );
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
      unitConversion,
      unitConversions: relations.conversions,
      inventorySettings: relations.inventorySettings,
      storageLocations: branchData.activeStorageLocations,
      currentDefaultLocation,
      attributeDefinitions,
      attributes: editableAttributes,
      salesPriceTiers: relations.salesPriceTiers.map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        unitPrice: tier.unitPrice,
        active: tier.active,
      })),
      suppliers,
      supplierProducts: relations.supplierProducts,
      media: editableMedia,
      promotionCount: relations.promotions.filter(
        (promotion) =>
          promotion.status === PromotionStatus.active ||
          promotion.status === PromotionStatus.scheduled,
      ).length,
      kitComponents: relations.kitComponents.map((component) => ({
        componentProductId: component.componentProductId,
        quantityPerKit: component.quantityPerKit,
      })),
      kitEligibleProducts,
    };
  }
}
