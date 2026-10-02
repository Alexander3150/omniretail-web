import { LocationStatus, ProductType, PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import type {
  ProductAttributeEditorValue,
  ProductEditorData,
  ProductMediaEditorValue,
  SupplierProductEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";
import { ensureCanReadProducts, resolveTenantContext } from "@/modules/catalog/application/services/serviceHelpers";

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
    const [allAttributeDefinitions, suppliers, allProducts, branch] = await Promise.all([
      access.canReadAttributes ? this.repositories.attributes.getDefinitions() : Promise.resolve([]),
      access.canManageSuppliers
        ? this.repositories.suppliers.getActiveByTenant(tenantId)
        : Promise.resolve([]),
      // Costo temporal documentado: Products API aún no filtra candidatos físicos de kit.
      // El adapter agrega todas las páginas únicamente para este selector del editor.
      this.repositories.products.getByTenant(tenantId),
      branchId
        ? this.repositories.branches.getByIdScoped(tenantId, branchId)
        : Promise.resolve(null),
    ]);
    // `getDefinitions()` aun es una lectura global legacy; se filtra antes de crear la DTO.
    const attributeDefinitions = allAttributeDefinitions.filter(
      (definition) => definition.tenantId === undefined || definition.tenantId === tenantId,
    );
    const tenantProducts = allProducts;
    // branchId llega del cliente (selector de sucursal): no se usa para leer ubicaciones ni
    // configuracion de inventario a menos que la sucursal exista y pertenezca al tenant activo.
    const tenantBranchId = branch && branch.tenantId === tenantId ? branch.id : undefined;
    const canReadLocations =
      !apiMode ||
      hasPermission("catalog.locations.read") ||
      hasPermission("catalog.locations.manage");
    const branchLocations = tenantBranchId && canReadLocations
      ? await this.repositories.inventory.getLocations(tenantBranchId)
      : [];
    const activeStorageLocations = branchLocations.filter(
      (location) => location.tenantId === tenantId && location.status === LocationStatus.active,
    );
    const kitEligibleProducts = (excludeProductId?: string) =>
      tenantProducts.filter(
        (product) =>
          product.id !== excludeProductId &&
          product.productType === "physical" &&
          product.tracking.stock,
      );

    if (!productId) {
      return {
        access,
        detail: null,
        unitConversion: null,
        unitConversions: [],
        inventorySettings: null,
        storageLocations: activeStorageLocations,
        currentDefaultLocation: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
        kitComponents: [],
        kitEligibleProducts: kitEligibleProducts(),
      };
    }

    // El productId puede venir de la URL: se valida la pertenencia al tenant ANTES de cargar el
    // detalle o cualquier colección relacionada -- un producto de otro tenant se trata igual que
    // uno inexistente y nunca dispara la carga pesada de GetProductDetailService.
    const product = tenantProducts.find((item) => item.id === productId);
    if (!product) {
      return {
        access,
        detail: null,
        unitConversion: null,
        unitConversions: [],
        inventorySettings: null,
        storageLocations: activeStorageLocations,
        currentDefaultLocation: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
        kitComponents: [],
        kitEligibleProducts: kitEligibleProducts(),
      };
    }

    const detail = await new GetProductDetailService(this.repositories).execute(productId);
    if (!detail) {
      return {
        access,
        detail: null,
        unitConversion: null,
        unitConversions: [],
        inventorySettings: null,
        storageLocations: activeStorageLocations,
        currentDefaultLocation: null,
        attributeDefinitions,
        attributes: [],
        salesPriceTiers: [],
        suppliers,
        supplierProducts: [],
        media: [],
        promotionCount: 0,
        kitComponents: [],
        kitEligibleProducts: kitEligibleProducts(),
      };
    }

    const [
      conversions,
      attributeValues,
      salesPriceTiers,
      supplierProducts,
      media,
      promotions,
      inventorySettings,
      kitComponents,
    ] = await Promise.all([
      detail.product.productType !== ProductType.kit && access.canReadConversions
        ? this.repositories.units.getConversionsByProductScoped(tenantId, productId)
        : Promise.resolve([]),
      this.repositories.attributes.getValuesByProduct(productId),
      this.repositories.productSalesPriceTiers.getByProduct(productId),
      detail.product.productType !== ProductType.kit && access.canManageSuppliers
        ? this.repositories.supplierProducts.getByProductForTenant(tenantId, productId)
        : Promise.resolve([]),
      this.repositories.productMedia.getByProduct(productId, tenantId),
      access.canReadPromotions
        ? this.repositories.promotions.getByProductScoped(tenantId, productId)
        : Promise.resolve([]),
      detail.product.productType === ProductType.physical &&
      detail.product.tracking.stock &&
      tenantBranchId &&
      access.canReadInventorySettings
        ? this.repositories.inventory.getProductInventorySettings(productId, tenantBranchId)
        : Promise.resolve(null),
      detail.product.productType === ProductType.kit
        ? this.repositories.productKitComponents.getByKitProduct(productId)
        : Promise.resolve([]),
    ]);
    const currentDefaultLocation = inventorySettings?.defaultLocationId
      ? (branchLocations.find((location) => location.id === inventorySettings.defaultLocationId) ??
        null)
      : null;

    const saleUnitId = detail.product.saleUnitId ?? detail.product.baseUnitId;
    const unitConversion =
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === detail.product.baseUnitId && conversion.toUnitId === saleUnitId,
      ) ??
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === saleUnitId && conversion.toUnitId === detail.product.baseUnitId,
      ) ??
      null;

    const supplierProductsWithCosts: SupplierProductEditorValue[] = await Promise.all(
      supplierProducts.map(async (supplierProduct) => {
        return {
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
          costTiers: (
            await this.repositories.supplierProducts.getCostTiers(supplierProduct.id)
          ).map((tier) => ({
            id: tier.id,
            minQuantity: tier.minQuantity,
            unitCost: tier.unitCost,
          })),
        };
      }),
    );

    const editableAttributes: ProductAttributeEditorValue[] = attributeValues.map((value) => {
      const definition = attributeDefinitions.find(
        (item) => item.id === value.attributeDefinitionId,
      );
      return {
        attributeDefinitionId: value.attributeDefinitionId,
        name: definition?.name ?? value.name ?? "Atributo",
        value: String(value.value),
      };
    });

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
      unitConversions: conversions,
      inventorySettings,
      storageLocations: activeStorageLocations,
      currentDefaultLocation,
      attributeDefinitions,
      attributes: editableAttributes,
      salesPriceTiers: salesPriceTiers.map((tier) => ({
        id: tier.id,
        minQuantity: tier.minQuantity,
        unitPrice: tier.unitPrice,
        active: tier.active,
      })),
      suppliers,
      supplierProducts: supplierProductsWithCosts,
      media: editableMedia,
      promotionCount: promotions.filter(
        (promotion) =>
          promotion.status === PromotionStatus.active ||
          promotion.status === PromotionStatus.scheduled,
      ).length,
      kitComponents: kitComponents.map((component) => ({
        componentProductId: component.componentProductId,
        quantityPerKit: component.quantityPerKit,
      })),
      kitEligibleProducts: kitEligibleProducts(productId),
    };
  }
}
