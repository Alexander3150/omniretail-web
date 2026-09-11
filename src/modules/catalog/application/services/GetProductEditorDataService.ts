import { LocationStatus, PromotionStatus } from "@/core/enums";
import type { RepositoryRegistry } from "@/infrastructure/providers/RepositoryProvider";
import { GetProductDetailService } from "@/modules/catalog/application/services/GetProductDetailService";
import type {
  ProductAttributeEditorValue,
  ProductEditorData,
  ProductMediaEditorValue,
  SupplierProductEditorValue,
  ProductKitComponentEditorValue,
} from "@/modules/catalog/application/dto/ProductEditorDto";

export class GetProductEditorDataService {
  constructor(private readonly repositories: RepositoryRegistry) {}

  async execute(
    tenantId: string,
    productId?: string,
    branchId?: string,
  ): Promise<ProductEditorData> {
    const [allAttributeDefinitions, suppliers, allProducts, branch] = await Promise.all([
      this.repositories.attributes.getDefinitions(),
      this.repositories.suppliers.getActiveByTenant(tenantId),
      this.repositories.products.getAll(),
      branchId ? this.repositories.branches.getById(branchId) : Promise.resolve(null),
    ]);
    // `getDefinitions()` y `getAll()` no aceptan tenantId: son lecturas globales del repository,
    // así que el boundary de la aplicación filtra antes de que cualquier dato cruce a la DTO.
    const attributeDefinitions = allAttributeDefinitions.filter(
      (definition) => definition.tenantId === tenantId,
    );
    const tenantProducts = allProducts.filter((product) => product.tenantId === tenantId);
    // branchId llega del cliente (selector de sucursal): no se usa para leer ubicaciones ni
    // configuracion de inventario a menos que la sucursal exista y pertenezca al tenant activo.
    const tenantBranchId = branch && branch.tenantId === tenantId ? branch.id : undefined;
    const branchLocations = tenantBranchId
      ? await this.repositories.inventory.getLocations(tenantBranchId)
      : [];
    const activeStorageLocations = branchLocations.filter(
      (location) => location.status === LocationStatus.active,
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
        detail: null,
        unitConversion: null,
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
        detail: null,
        unitConversion: null,
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
        detail: null,
        unitConversion: null,
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
      inventorySettings, kitComponents,
    ] = await Promise.all([
      this.repositories.units.getConversionsByProduct(productId),
      this.repositories.attributes.getValuesByProduct(productId),
      this.repositories.productSalesPriceTiers.getByProduct(productId),
      this.repositories.supplierProducts.getByProductForTenant(tenantId, productId),
      this.repositories.productMedia.getByProduct(productId),
      this.repositories.promotions.getByProduct(productId),
      tenantBranchId
        ? this.repositories.inventory.getProductInventorySettings(productId, tenantBranchId)
        : Promise.resolve(null),
      this.repositories.productKitComponents.getByKitProduct(productId),
    ]);
    const currentDefaultLocation =
      inventorySettings?.defaultLocationId
        ? branchLocations.find((location) => location.id === inventorySettings.defaultLocationId) ??
          null
        : null;

    const saleUnitId = detail.product.saleUnitId ?? detail.product.baseUnitId;
    const unitConversion =
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === detail.product.baseUnitId &&
          conversion.toUnitId === saleUnitId,
      ) ??
      conversions.find(
        (conversion) =>
          conversion.fromUnitId === saleUnitId &&
          conversion.toUnitId === detail.product.baseUnitId,
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
          costTiers: (await this.repositories.supplierProducts.getCostTiers(supplierProduct.id)).map(
            (tier) => ({
              id: tier.id,
              minQuantity: tier.minQuantity,
              unitCost: tier.unitCost,
            }),
          ),
        };
      }),
    );

    const editableAttributes: ProductAttributeEditorValue[] = attributeValues.map((value) => {
      const definition = attributeDefinitions.find(
        (item) => item.id === value.attributeDefinitionId,
      );
      return {
        attributeDefinitionId: value.attributeDefinitionId,
        name: definition?.name ?? "Atributo",
        value: String(value.value),
      };
    });

    const editableMedia: ProductMediaEditorValue[] = media.map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      alt: item.alt,
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
    }));

    return {
      detail,
      unitConversion,
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
